import { state } from "./core/state.js";
import { buildHash, parseRoute } from "./core/router.js";

function basePath() {
  const local = `${window.location.origin}${window.location.pathname.replace(/\/$/, "") || ""}`;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (isLocal) return local;

  const canonical = state.mapa?.embedBase?.replace(/\/$/, "");
  if (canonical) {
    try {
      const host = new URL(canonical).hostname;
      if (window.location.hostname === host) return local;
    } catch {
      /* ignore */
    }
  }

  return canonical || local;
}

function viewHash() {
  const parsed = parseRoute();
  return buildHash({
    view: parsed.entityId ? "entity" : parsed.tiId ? "ti" : "bahia",
    tiId: parsed.tiId,
    entityId: parsed.entityId,
    filters: state.filters,
  });
}

export function getShareUrl() {
  return `${basePath()}${viewHash()}`;
}

export function getEmbedUrl() {
  const url = new URL(getShareUrl());
  url.searchParams.set("embed", "1");
  return url.href;
}

export function getEmbedCode(width = "100%", height = "480") {
  const src = getEmbedUrl();
  return `<iframe src="${src}" width="${width}" height="${height}" style="border:0;border-radius:8px;max-width:100%" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="MOVIMENTO IRUN — Mapa territorial da Bahia"></iframe>`;
}

export function isEmbedMode() {
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

export function initEmbedMode() {
  if (!isEmbedMode()) return;

  document.body.classList.add("embed-mode");

  const exit = document.createElement("a");
  exit.id = "embed-exit";
  exit.className = "embed-exit";
  exit.href = getShareUrl();
  exit.target = "_blank";
  exit.rel = "noopener";
  exit.textContent = "Abrir mapa completo ↗";
  document.querySelector(".map-area")?.appendChild(exit);

  window.addEventListener("hashchange", () => {
    exit.href = getShareUrl();
  });
}

function copyText(text, okMsg) {
  navigator.clipboard.writeText(text).then(() => showToast(okMsg)).catch(() => {
    prompt("Copie:", text);
  });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function refreshShareFields() {
  const urlInput = document.getElementById("share-url");
  const embedArea = document.getElementById("share-embed");
  if (urlInput) urlInput.value = getShareUrl();
  if (embedArea) embedArea.value = getEmbedCode();
}

function openSharePanel() {
  const overlay = document.getElementById("share-overlay");
  if (!overlay) {
    shareCurrentView();
    return;
  }
  refreshShareFields();
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeSharePanel() {
  const overlay = document.getElementById("share-overlay");
  overlay?.classList.remove("open");
  overlay?.setAttribute("aria-hidden", "true");
}

export function shareCurrentView() {
  const url = getShareUrl();
  if (navigator.share && !document.getElementById("share-overlay")) {
    navigator.share({
      title: "MOVIMENTO IRUN — Identidade e Território",
      text: "Mapa territorial da Bahia",
      url,
    }).catch(() => copyText(url, "Link copiado!"));
  } else {
    openSharePanel();
  }
}

export function initShare() {
  initEmbedMode();

  document.getElementById("btn-share")?.addEventListener("click", openSharePanel);
  document.getElementById("share-close")?.addEventListener("click", closeSharePanel);

  document.getElementById("share-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "share-overlay") closeSharePanel();
  });

  document.getElementById("share-copy-url")?.addEventListener("click", () => {
    copyText(getShareUrl(), "Link copiado!");
  });

  document.getElementById("share-copy-embed")?.addEventListener("click", () => {
    copyText(getEmbedCode(), "Código de incorporação copiado!");
  });

  document.getElementById("share-native")?.addEventListener("click", () => {
    const url = getShareUrl();
    navigator.share?.({
      title: "MOVIMENTO IRUN — Identidade e Território",
      text: "Mapa territorial da Bahia",
      url,
    }).catch(() => copyText(url, "Link copiado!"));
  });

  if (navigator.share) {
    document.getElementById("share-native")?.removeAttribute("hidden");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("share-overlay")?.classList.contains("open")) {
      closeSharePanel();
    }
  });

  window.addEventListener("hashchange", () => {
    if (document.getElementById("share-overlay")?.classList.contains("open")) {
      refreshShareFields();
    }
  });
}

export { showToast };
