import { state, countRedeAtiva, toggleFilter } from "../core/state.js";
import { goBahia, goTerritorio, goEntity } from "../core/router.js";
import { openSheetForTerritory } from "../shell.js";
import { renderSlideshow, bindSlideshows } from "./slideshow.js";

const FILTER_GROUPS = [
  {
    label: "Tipo territorial",
    items: [
      { key: "municipios", label: "Municípios" },
      { key: "quilombos", label: "Quilombos / Assentamentos" },
    ],
  },
  {
    label: "Temática",
    items: [
      { key: "turismo", label: "Turismo" },
      { key: "natureza", label: "Natureza" },
      { key: "instituicoes", label: "Instituições" },
      { key: "producao", label: "Produção" },
      { key: "projetos", label: "Projetos" },
    ],
  },
];

const DIM_LABELS = [
  "História e memória", "Cultura", "Meio ambiente", "Património", "Economia",
  "Comunidade", "Educação", "Mobilidade", "Potencialidades", "Visão de futuro",
];

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function tiById(id) {
  return state.territorios.find((t) => t.id === id);
}

function prevTi(id) {
  const i = state.territorios.findIndex((t) => t.id === id);
  return state.territorios[(i - 1 + state.territorios.length) % state.territorios.length];
}

function nextTi(id) {
  const i = state.territorios.findIndex((t) => t.id === id);
  return state.territorios[(i + 1) % state.territorios.length];
}

function redeOrdered() {
  return [...state.entidades.filter((e) => e.rede)].sort((a, b) => {
    const ca = tiById(a.territorioId)?.cod || "99";
    const cb = tiById(b.territorioId)?.cod || "99";
    return Number(ca) - Number(cb);
  });
}

function renderTiPager(tiId, backAction = "bahia", backLabel = "Bahia") {
  const cur = tiById(tiId);
  if (!cur) return "";
  const prev = prevTi(tiId);
  const next = nextTi(tiId);
  return `
    <nav class="nav-pager" aria-label="Navegar territórios de identidade">
      <button type="button" class="nav-pager-btn" data-nav="ti-prev" data-ti="${prev.id}" title="${esc(prev.nome)}">
        <span class="nav-arrow">←</span><span class="nav-label">${esc(prev.nome)}</span>
      </button>
      <button type="button" class="nav-pager-btn nav-pager-back" data-nav="${backAction}"${backAction === "ti" ? ` data-ti="${tiId}"` : ""}>
        ← ${esc(backLabel)}
      </button>
      <button type="button" class="nav-pager-btn" data-nav="ti-next" data-ti="${next.id}" title="${esc(next.nome)}">
        <span class="nav-label">${esc(next.nome)}</span><span class="nav-arrow">→</span>
      </button>
    </nav>`;
}

function renderRedeTiPager(tiId) {
  const list = state.entidades.filter((e) => e.territorioId === tiId);
  if (list.length < 2) return "";
  const prev = list[list.length - 1];
  const next = list[0];
  return `
    <nav class="nav-rede-pager" aria-label="Navegar REDE neste território">
      <button type="button" class="nav-pager-btn" data-nav="rede-prev" data-ti="${prev.territorioId}" data-entity="${prev.id}">
        <span class="nav-arrow">←</span><span class="nav-label">${esc(prev.meta?.nome || prev.id)}</span>
      </button>
      <span class="nav-rede-pos">REDE · ${list.length} fichas</span>
      <button type="button" class="nav-pager-btn" data-nav="rede-next" data-ti="${next.territorioId}" data-entity="${next.id}">
        <span class="nav-label">${esc(next.meta?.nome || next.id)}</span><span class="nav-arrow">→</span>
      </button>
    </nav>`;
}

function renderRedePager(entityId) {
  const list = redeOrdered();
  if (list.length < 2) return "";
  const i = list.findIndex((e) => e.id === entityId);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  return `
    <nav class="nav-rede-pager" aria-label="Navegar REDE">
      <button type="button" class="nav-pager-btn" data-nav="rede-prev" data-ti="${prev.territorioId}" data-entity="${prev.id}">
        <span class="nav-arrow">←</span><span class="nav-label">${esc(prev.meta?.nome || prev.id)}</span>
      </button>
      <span class="nav-rede-pos">REDE ${i + 1}/${list.length}</span>
      <button type="button" class="nav-pager-btn" data-nav="rede-next" data-ti="${next.territorioId}" data-entity="${next.id}">
        <span class="nav-label">${esc(next.meta?.nome || next.id)}</span><span class="nav-arrow">→</span>
      </button>
    </nav>`;
}

function accordion(id, title, bodyHtml, open = false, cls = "") {
  return `
    <div class="accordion${open ? " open" : ""}${cls ? ` ${cls}` : ""}" data-acc="${id}">
      <button type="button" class="accordion-trigger" aria-expanded="${open}">
        ${esc(title)} <span class="chevron" aria-hidden="true">▼</span>
      </button>
      <div class="accordion-panel"><div class="accordion-body">${bodyHtml}</div></div>
    </div>`;
}

function subAccordion(id, title, bodyHtml) {
  return `
    <div class="sub-accordion" data-sub="${id}">
      <button type="button" class="sub-trigger" aria-expanded="false">
        ${esc(title)} <span class="chevron-sm">›</span>
      </button>
      <div class="sub-panel"><p>${bodyHtml}</p></div>
    </div>`;
}

function verMais(href, label = "Ver mais no site →") {
  if (!href) return "";
  return `<p class="ver-mais"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a></p>`;
}

function renderFilters() {
  return FILTER_GROUPS.map(
    (g) => `
    <div class="filter-group">
      <div class="filter-label">${esc(g.label)}</div>
      <div class="filter-chips">
        ${g.items
          .map(
            (i) =>
              `<button type="button" class="chip${state.filters.has(i.key) ? " active" : ""}" data-filter="${i.key}">${esc(i.label)}</button>`
          )
          .join("")}
      </div>
    </div>`
  ).join("");
}

function renderTiList(activeId = null) {
  return `<ul class="ti-list">
    ${state.territorios
      .map(
        (t) => `
      <li class="ti-item${t.id === activeId ? " active" : ""}${t.redeAtiva ? " rede-active" : ""}" data-ti="${t.id}" tabindex="0" role="button">
        <span class="ti-cod">${t.cod}</span>
        <span class="ti-nome">${esc(t.nome)}</span>
      </li>`
      )
      .join("")}
  </ul>`;
}

function renderEntityCards(entidades, tiId) {
  if (!entidades.length) return `<p class="empty-rede">Nenhuma entidade mapeada neste território ainda.</p>`;
  return `<ul class="entity-list">
    ${entidades
      .map(
        (e) => `
      <li class="entity-card" data-ti="${tiId}" data-entity="${e.id}" tabindex="0" role="button">
        <span class="entity-badge">REDE</span>
        <span class="entity-name">${esc(e.meta?.nome || e.id)}</span>
        <span class="entity-arrow">→</span>
      </li>`
      )
      .join("")}
  </ul>`;
}

function renderList(items, key = "nome") {
  if (!items?.length) return `<p class="empty-rede">Conteúdo em breve.</p>`;
  return `<ul class="content-list">${items.map((i) => `<li>${esc(i[key] || i.titulo || i.nome || "")}${i.descricao ? ` — <span class="muted">${esc(i.descricao)}</span>` : ""}</li>`).join("")}</ul>`;
}

function renderLinks(items) {
  if (!items?.length) return "";
  return `<ul class="link-list">${items.map((i) => `<li><a href="${esc(i.href)}" target="_blank" rel="noopener">${esc(i.titulo || i.handle || i.href)}</a></li>`).join("")}</ul>`;
}

const YT_PARAMS = "rel=0&modestbranding=1&iv_load_policy=3";

function renderVideos(videos) {
  if (!videos?.length) return `<p class="empty-rede">Vídeos em breve.</p>`;
  return videos.map((v) => {
    if (v.tipo === "youtube" && v.id) {
      return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}?${YT_PARAMS}" title="${esc(v.titulo)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="video-title">${esc(v.titulo)}</p></div>`;
    }
    return `<p><a href="${esc(v.href)}" target="_blank" rel="noopener">${esc(v.titulo)}</a></p>`;
  }).join("");
}

function renderPortfolio(items) {
  if (!items?.length) return `<p class="empty-rede">Portfólio em breve.</p>`;
  return `<ul class="link-list">${items.map((i) => `<li><a href="${esc(i.href)}" target="_blank" rel="noopener" class="pdf-link">${esc(i.titulo)} ↗</a></li>`).join("")}</ul>`;
}

function renderIdentidade(dims) {
  if (!dims?.length) {
    return `<p style="font-size:0.82rem">${DIM_LABELS.join(" · ")}</p>`;
  }
  return dims.map((d) => subAccordion(d.id, d.titulo, esc(d.conteudo))).join("");
}

function renderContato(c, externo) {
  if (!c && !externo?.contato) return "";
  let html = "";
  if (c?.organizacao) html += `<p class="lead">${esc(c.organizacao)}</p>`;
  if (c?.gestores?.length) {
    html += `<p class="section-title">Gestores</p><ul class="content-list">${c.gestores.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`;
  }
  if (c?.email) html += `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>`;
  if (c?.endereco) {
    if (c?.maps) {
      html += `<p><a href="${esc(c.maps)}" target="_blank" rel="noopener">${esc(c.endereco)}</a></p>`;
    } else {
      html += `<p>${esc(c.endereco)}</p>`;
    }
  }
  if (c?.whatsapp) html += `<p><a href="${esc(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp — encomendas →</a></p>`;
  if (c?.maps && !c?.endereco) html += `<p><a href="${esc(c.maps)}" target="_blank" rel="noopener">Google Maps →</a></p>`;
  if (externo?.contato) html += verMais(externo.contato, "Contacto no site →");
  if (externo?.about) html += verMais(externo.about, "Sobre o Kilombo →");
  return html;
}

function renderBahia() {
  const m = state.mapa;
  const rede = countRedeAtiva();
  const meta = m?.redeMeta || 27;
  const entidadesRede = redeOrdered();
  const sobreHtml = (m?.sobre || []).map((p) => `<p class="lead">${esc(p)}</p>`).join("");

  const redeList = entidadesRede.length
    ? entidadesRede.map((e) => {
        const ti = tiById(e.territorioId);
        return `<li class="entity-card" data-ti="${e.territorioId}" data-entity="${e.id}" tabindex="0" role="button">
          <span class="entity-badge">TI ${ti?.cod || "—"}</span>
          <span class="entity-name">${esc(e.meta?.nome || e.id)}</span>
          <span class="entity-arrow">→</span>
        </li>`;
      }).join("")
    : "";

  return `
    ${accordion("sobre", m?.sobreTitulo || "Sobre o Mapa", `${sobreHtml}
       <p class="section-title">Fonte geográfica</p>
       <p style="font-size:0.82rem">${esc(m?.source?.geographic || "")}</p>`, true)}
    ${accordion("territorios", "27 Territórios de Identidade", renderTiList(), false)}
    ${accordion("rede", `REDE Movimento Irun (${rede}/${meta})`, `
       <p class="lead">Territórios com mapeamento participativo activo.</p>
       ${redeList ? `<ul class="entity-list">${redeList}</ul>` : `<p class="empty-rede">Nenhum território mapeado ainda.</p>`}`, entidadesRede.length > 0)}
    ${accordion("filtros", "Filtros", renderFilters(), false)}
  `;
}

function renderTerritorio(ti) {
  const entidades = state.entidades.filter((e) => e.territorioId === ti.id);

  return `
    ${renderTiPager(ti.id, "bahia", "Bahia")}
    ${renderRedeTiPager(ti.id)}
    <div class="ti-header-cod">${ti.cod} — Território de Identidade</div>
    <h2 class="ti-header-title">${esc(ti.nome)}</h2>
    <p class="lead">Território oficial de planejamento do Estado da Bahia (SEI/SEPLAN · SecultBA).</p>
    ${accordion("identidade", "Identidade do Território", `
       <p class="section-title">Dimensões</p>
       <p style="font-size:0.82rem">${DIM_LABELS.join(" · ")}</p>`, true)}
    ${accordion("rede-ti", `REDE neste território (${entidades.length})`, renderEntityCards(entidades, ti.id), entidades.length > 0)}
    ${accordion("territorios-nav", "Ir para outro território", renderTiList(ti.id), false)}
  `;
}

function renderEntidade(e, ti) {
  const s = e.sidebar || {};
  const ext = s.externo || {};
  const sections = [];

  sections.push(accordion("apresentacao", "Apresentação", `<p class="lead">${esc(s.apresentacao || "")}</p>${ext.about ? verMais(ext.about, "Ler mais no site →") : ""}`, true));
  sections.push(accordion("identidade-e", "Identidade", renderIdentidade(s.identidade), false));

  if (s.produtos?.length || ext.produtos) {
    sections.push(accordion("produtos", "Produtos", `${renderList(s.produtos || [])}${verMais(ext.produtos, "Ver todos os produtos →")}`, false));
  }
  if (s.roteiros?.length || ext.reservas) {
    sections.push(accordion("roteiros", "Turismo e vivências", `${renderList(s.roteiros || [], "titulo")}${verMais(ext.reservas, "Reservar estadia →")}`, false));
  }
  if (s.fotos?.length) sections.push(accordion("fotos", `Fotos (${s.fotos.length})`, renderSlideshow(s.fotos), false));
  if (s.videos?.length) sections.push(accordion("videos", `Vídeos (${s.videos.length})`, renderVideos(s.videos), false));
  if (s.portfolio?.length) sections.push(accordion("portfolio", "Portfólio", renderPortfolio(s.portfolio), false));
  if (s.festas?.length || ext.eventos) {
    sections.push(accordion("festas", "Festas e eventos", `${renderList(s.festas || [])}${verMais(ext.eventos, "Ver eventos no site →")}`, false));
  }
  if (s.noticias?.length) sections.push(accordion("noticias", "Notícias", renderLinks(s.noticias.map((n) => ({ href: n.href, titulo: n.titulo }))), false));
  if (s.redes?.length || s.links?.length || ext.site) {
    const links = [
      ...(ext.site ? [{ href: ext.site, titulo: "Site oficial" }] : []),
      ...(s.redes?.map((r) => ({ href: r.href, titulo: `${r.rede}: ${r.handle}` })) || []),
      ...(s.links || []),
    ];
    sections.push(accordion("redes", "Redes e links", renderLinks(links), false));
  }
  sections.push(accordion("contato", "Contato", renderContato(s.contato, ext), false));

  return `
    ${renderTiPager(ti.id, "ti", ti.nome)}
    ${renderRedePager(e.id)}
    <div class="ti-header-cod">${ti.cod} · REDE · ${e.tipo}</div>
    <h2 class="ti-header-title">${esc(e.meta?.nome || e.id)}</h2>
    <p class="lead">${esc(e.meta?.municipio || "")}${e.meta?.uf ? ` — ${e.meta.uf}` : ""}</p>
    ${sections.join("")}
  `;
}

export function renderSidebar(route) {
  const el = document.getElementById("sidebar-content");
  if (!el) return;

  if (route.view === "entity" && route.entityId && route.tiId) {
    const ti = tiById(route.tiId);
    const ent = state.entidades.find((e) => e.id === route.entityId);
    el.innerHTML = ti && ent ? renderEntidade(ent, ti) : renderBahia();
  } else if (route.view === "ti" && route.tiId) {
    const ti = tiById(route.tiId);
    el.innerHTML = ti ? renderTerritorio(ti) : renderBahia();
  } else {
    el.innerHTML = renderBahia();
  }

  bindSidebarEvents(el, route);
  bindSlideshows(el);
}

function bindSidebarEvents(el, route) {
  el.querySelectorAll(".accordion-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acc = btn.closest(".accordion");
      const wasOpen = acc.classList.contains("open");
      const parent = acc.closest(".accordion-body") || el;
      parent.querySelectorAll(":scope > .accordion.open, .accordion-body > .accordion.open").forEach((a) => {
        if (a !== acc && !acc.contains(a)) {
          a.classList.remove("open");
          a.querySelector(".accordion-trigger")?.setAttribute("aria-expanded", "false");
        }
      });
      if (!wasOpen) {
        acc.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      } else {
        acc.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  });

  el.querySelectorAll(".sub-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.closest(".sub-accordion");
      const open = sub.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  el.querySelectorAll(".ti-item").forEach((item) => {
    const go = () => { goTerritorio(item.dataset.ti); openSheetForTerritory(); };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll(".entity-card").forEach((card) => {
    const go = () => { goEntity(card.dataset.ti, card.dataset.entity); openSheetForTerritory(); };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      toggleFilter(chip.dataset.filter);
      renderSidebar(route);
    });
  });

  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      if (nav === "bahia") goBahia();
      else if (nav === "ti") goTerritorio(btn.dataset.ti);
      else if (nav === "ti-prev" || nav === "ti-next") goTerritorio(btn.dataset.ti);
      else if (nav === "rede-prev" || nav === "rede-next") goEntity(btn.dataset.ti, btn.dataset.entity);
      openSheetForTerritory();
    });
  });
}

export function initSidebarKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (!e.target.closest(".sidebar-content")) return;
    const triggers = [...document.querySelectorAll(".sidebar-content .accordion-trigger")];
    const idx = triggers.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && idx >= 0 && idx < triggers.length - 1) {
      e.preventDefault();
      triggers[idx + 1].focus();
    }
    if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      triggers[idx - 1].focus();
    }
  });
}
