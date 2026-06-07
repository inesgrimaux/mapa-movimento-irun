import { state } from "./core/state.js";
import { goTerritorio, goEntity } from "./core/router.js";
import { focusEntity, focusPin, openPinPopup } from "./map/map.js";
import { openSheetForTerritory } from "./shell.js";

const SVG_SEARCH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';

let index = [];
let activeIdx = -1;

function norm(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(text) {
  return norm(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
}

function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

function maxTypos(len) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/** Pontua o quão bem `query` casa com `word` (0 = sem match). */
function matchWord(query, word) {
  if (!query || !word) return 0;
  if (query === word) return 100;
  if (word.includes(query)) return 92;
  if (query.includes(word) && word.length >= 4) return 85;

  const minPrefix = query.length >= 3 ? 3 : query.length;
  if (word.startsWith(query) && query.length >= minPrefix) return 78;
  if (query.startsWith(word) && word.length >= 4) return 72;

  const dist = editDistance(query, word, maxTypos(query.length));
  const allowed = maxTypos(Math.min(query.length, word.length));
  if (dist <= allowed) return 58 - dist * 12;

  return 0;
}

function matchToken(queryWord, item) {
  let best = 0;

  for (const word of item.words) {
    best = Math.max(best, matchWord(queryWord, word));
  }

  if (item.text.includes(queryWord)) best = Math.max(best, 88);

  const label = norm(item.label);
  if (label.includes(queryWord)) best = Math.max(best, 95);
  if (matchWord(queryWord, label.replace(/\s+/g, ""))) best = Math.max(best, 70);

  return best;
}

function entityExtraText(e) {
  const s = e.sidebar || {};
  return [
    ...(s.identidade || []).map((d) => `${d.titulo} ${d.conteudo}`),
    ...(s.festas || []).map((f) => `${f.nome} ${f.descricao || ""}`),
    ...(s.produtos || []).map((p) => `${p.nome} ${p.descricao || ""}`),
    ...(s.roteiros || []).map((r) => `${r.titulo} ${r.descricao || ""}`),
    ...(s.redes || []).map((r) => r.handle || ""),
  ].join(" ");
}

function minQueryLength(q) {
  if (/^\d+$/.test(q)) return 1;
  return 2;
}

function tiName(tiId) {
  return state.territorios.find((t) => t.id === tiId)?.nome || "";
}

function tiCod(tiId) {
  return state.territorios.find((t) => t.id === tiId)?.cod || "";
}

function makeItem(raw) {
  const text = raw.text || norm(raw.label);
  return { ...raw, text, words: tokenize(`${raw.label} ${text}`) };
}

export function buildSearchIndex() {
  const items = [];

  for (const t of state.territorios) {
    items.push(
      makeItem({
        kind: "ti",
        id: t.id,
        tiId: t.id,
        entityId: null,
        pinId: null,
        label: t.nome,
        sub: `${t.cod} — Território de Identidade`,
        badge: "TI",
        text: norm(`${t.cod} ${t.nome} ${t.id} territorio identidade`),
      })
    );
  }

  for (const e of state.entidades) {
    if (!e.rede) continue;
    const ti = state.territorios.find((t) => t.id === e.territorioId);
    items.push(
      makeItem({
        kind: "entity",
        id: e.id,
        tiId: e.territorioId,
        entityId: e.id,
        pinId: null,
        label: e.meta?.nome || e.id,
        sub: `${ti?.cod || "—"} · REDE · ${e.meta?.municipio || e.tipo || ""}`,
        badge: "REDE",
        text: norm(
          `${e.meta?.nome} ${e.meta?.municipio} ${e.tipo} ${e.id} ${e.sidebar?.apresentacao || ""} ${entityExtraText(e)} ${ti?.nome}`
        ),
      })
    );
  }

  for (const p of state.pontos) {
    const tiId = p.territorioId;
    const ent = p.entidadeId ? state.entidades.find((e) => e.id === p.entidadeId) : null;
    items.push(
      makeItem({
        kind: "pin",
        id: p.id,
        tiId,
        entityId: p.entidadeId || null,
        pinId: p.id,
        coords: p.coords,
        label: p.nome,
        sub: `${tiCod(tiId)} ${tiName(tiId)}${p.resumo ? ` · ${p.resumo}` : ""}`,
        badge: "PIN",
        text: norm(
          `${p.nome} ${p.resumo || ""} ${(p.categorias || []).join(" ")} ${ent ? entityExtraText(ent) : ""} ${ent?.meta?.nome || ""} ${tiName(tiId)}`
        ),
      })
    );
  }

  index = items;
  return index;
}

export function search(query, limit = 24) {
  const q = norm(query);
  if (q.length < minQueryLength(q)) return [];

  const words = q.split(/\s+/).filter(Boolean);
  const scored = [];

  for (const item of index) {
    let score = 0;
    let allMatch = true;

    for (const w of words) {
      const m = matchToken(w, item);
      if (m <= 0) {
        allMatch = false;
        break;
      }
      score += m;
    }

    if (!allMatch) continue;

    const label = norm(item.label);
    if (label.startsWith(q)) score += 40;
    else if (label.includes(q)) score += 25;
    if (item.kind === "entity") score += 8;
    if (item.kind === "ti") score += 5;

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "pt"));
  return scored.slice(0, limit).map((s) => s.item);
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function groupResults(results) {
  const groups = [
    { key: "ti", title: "Territórios de Identidade" },
    { key: "entity", title: "REDE — fichas" },
    { key: "pin", title: "Lugares no mapa" },
  ];
  return groups
    .map((g) => ({
      ...g,
      items: results.filter((r) => r.kind === g.key).slice(0, 8),
    }))
    .filter((g) => g.items.length);
}

function renderResults(results) {
  const el = document.getElementById("search-results");
  if (!el) return;

  if (!results.length) {
    el.innerHTML = `<p class="search-empty">Nenhum resultado. Tente <strong>rendeiras</strong>, <strong>samba</strong>, <strong>Caxuté</strong> ou <strong>26</strong> — toleramos pequenos erros de digitação.</p>`;
    return;
  }

  activeIdx = -1;
  const groups = groupResults(results);
  el.innerHTML = groups
    .map(
      (g) => `
    <div class="search-group">
      <div class="search-group-title">${esc(g.title)}</div>
      <ul class="search-list" role="listbox">
        ${g.items
          .map(
            (item) => `
          <li>
            <button type="button" class="search-item" data-kind="${item.kind}" data-ti="${item.tiId || ""}" data-entity="${item.entityId || ""}" data-pin="${item.pinId || ""}" role="option">
              <span class="search-badge">${esc(item.badge)}</span>
              <span class="search-item-text">
                <span class="search-item-label">${esc(item.label)}</span>
                <span class="search-item-sub">${esc(item.sub)}</span>
              </span>
            </button>
          </li>`
          )
          .join("")}
      </ul>
    </div>`
    )
    .join("");

  el.querySelectorAll(".search-item").forEach((btn, i) => {
    btn.dataset.idx = String(i);
    btn.addEventListener("click", () => selectItem(btn));
  });
}

function selectItem(btn) {
  const kind = btn.dataset.kind;
  const tiId = btn.dataset.ti;
  const entityId = btn.dataset.entity;
  const pinId = btn.dataset.pin;

  closeSearch();

  if (kind === "entity" && tiId && entityId) {
    goEntity(tiId, entityId);
    const ent = state.entidades.find((e) => e.id === entityId);
    if (ent) focusEntity(ent);
    openSheetForTerritory();
    return;
  }

  if (kind === "ti" && tiId) {
    goTerritorio(tiId);
    openSheetForTerritory();
    return;
  }

  if (kind === "pin" && tiId) {
    const pin = state.pontos.find((p) => p.id === pinId);
    if (entityId) {
      goEntity(tiId, entityId);
      const ent = state.entidades.find((e) => e.id === entityId);
      if (ent) focusEntity(ent);
    } else {
      goTerritorio(tiId);
    }
    if (pin?.coords) {
      focusPin(pin.coords);
      openPinPopup(pinId);
    }
    openSheetForTerritory();
  }
}

function openSearch() {
  const overlay = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  overlay?.classList.add("open");
  overlay?.setAttribute("aria-hidden", "false");
  input?.focus();
  input?.select();
  runSearch(input?.value || "");
}

function closeSearch() {
  const overlay = document.getElementById("search-overlay");
  overlay?.classList.remove("open");
  overlay?.setAttribute("aria-hidden", "true");
  activeIdx = -1;
}

function runSearch(q) {
  renderResults(search(q));
}

function highlightItem(idx) {
  const items = [...document.querySelectorAll(".search-item")];
  items.forEach((el, i) => el.classList.toggle("active", i === idx));
  items[idx]?.scrollIntoView({ block: "nearest" });
  activeIdx = idx;
}

export function initSearch() {
  buildSearchIndex();

  const overlay = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  const closeBtn = document.getElementById("search-close");

  document.querySelectorAll("[data-open-search]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openSearch();
    });
  });

  closeBtn?.addEventListener("click", closeSearch);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });

  input?.addEventListener("input", () => runSearch(input.value));
  input?.addEventListener("keydown", (e) => {
    const items = document.querySelectorAll(".search-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightItem(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightItem(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0 && items[activeIdx]) {
      e.preventDefault();
      selectItem(items[activeIdx]);
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openSearch();
    }
    if (e.key === "/" && !e.target.closest("input, textarea")) {
      e.preventDefault();
      openSearch();
    }
  });

  renderResults([]);
}

export { SVG_SEARCH };
