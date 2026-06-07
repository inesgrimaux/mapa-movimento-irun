import { state, notify } from "./core/state.js";

const MOBILE_BP = 768;
const SNAP = { closed: 0, peek: 72, mid: 0.55, full: 0.92 };

let sheetLevel = "closed";
let dragStartY = 0;
let dragStartH = 0;
let dragging = false;

export function isMobile() {
  return window.innerWidth <= MOBILE_BP;
}

export function initShell(onTerritoryOpen) {
  state.onTerritoryOpen = onTerritoryOpen;

  document.getElementById("btn-menu")?.addEventListener("click", () => {
    toggleSheet(sheetLevel === "closed" ? "mid" : "closed");
  });

  document.getElementById("btn-close-sidebar")?.addEventListener("click", () => {
    if (isMobile()) closeSheet();
    else setDesktopCollapsed(true);
  });

  document.getElementById("btn-reopen-desktop")?.addEventListener("click", () => {
    setDesktopCollapsed(false);
  });

  document.getElementById("sheet-peek")?.addEventListener("click", () => {
    openSheet("mid");
  });

  initSheetDrag();

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      closeSheet(true);
      applyDesktopLayout();
    } else {
      document.body.classList.remove("sidebar-collapsed");
      applySheetHeight(SNAP.closed);
    }
  });

  applyDesktopLayout();
}

function applyDesktopLayout() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  if (isMobile()) {
    sidebar.style.height = "";
    sidebar.classList.remove("desktop-visible");
  } else {
    sidebar.classList.add("desktop-visible");
    sidebar.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "false");
    document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  }
}

export function setDesktopCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  notify();
}

export function openSheet(level = "mid") {
  if (!isMobile()) return;
  sheetLevel = level;
  const sidebar = document.getElementById("sidebar");
  sidebar?.classList.add("open");
  sidebar?.setAttribute("aria-hidden", "false");
  document.getElementById("btn-menu")?.setAttribute("aria-expanded", "true");
  document.getElementById("sheet-peek")?.classList.add("hidden");
  applySheetLevel(level);
  state.sidebarOpen = true;
  notify();
}

export function closeSheet(silent = false) {
  if (!isMobile()) return;
  sheetLevel = "closed";
  const sidebar = document.getElementById("sidebar");
  sidebar?.classList.remove("open", "sheet-mid", "sheet-full");
  sidebar?.setAttribute("aria-hidden", "true");
  sidebar.style.height = "";
  document.getElementById("btn-menu")?.setAttribute("aria-expanded", "false");
  document.getElementById("sheet-peek")?.classList.remove("hidden");
  state.sidebarOpen = false;
  if (!silent) notify();
}

export function toggleSheet(level) {
  if (sheetLevel === "closed") openSheet(level);
  else closeSheet();
}

export function openSheetForTerritory() {
  if (isMobile()) openSheet("mid");
}

function applySheetLevel(level) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("sheet-mid", "sheet-full");
  if (level === "mid") sidebar.classList.add("sheet-mid");
  if (level === "full") sidebar.classList.add("sheet-full");
}

function applySheetHeight(px) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar || !isMobile()) return;
  const max = window.innerHeight * SNAP.full;
  const h = Math.max(SNAP.peek, Math.min(px, max));
  sidebar.style.height = `${h}px`;
}

function initSheetDrag() {
  const handle = document.getElementById("sheet-handle");
  const peek = document.getElementById("sheet-peek");
  const sidebar = document.getElementById("sidebar");

  const onStart = (clientY) => {
    if (!isMobile()) return;
    dragging = true;
    dragStartY = clientY;
    dragStartH = sidebar?.classList.contains("open")
      ? sidebar.offsetHeight
      : SNAP.peek;
    sidebar?.classList.add("dragging");
  };

  const onMove = (clientY) => {
    if (!dragging || !isMobile()) return;
    const dy = dragStartY - clientY;
    applySheetHeight(dragStartH + dy);
  };

  const onEnd = (clientY) => {
    if (!dragging) return;
    dragging = false;
    sidebar?.classList.remove("dragging");
    if (!isMobile()) return;

    const h = sidebar.offsetHeight;
    const vh = window.innerHeight;
    const mid = vh * SNAP.mid;
    const full = vh * SNAP.full;

    if (h < vh * 0.18) {
      closeSheet();
    } else if (h < (mid + full) / 2) {
      openSheet("mid");
    } else {
      openSheet("full");
    }
  };

  [handle, peek].forEach((el) => {
    el?.addEventListener("touchstart", (e) => onStart(e.touches[0].clientY), { passive: true });
    el?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onStart(e.clientY);
    });
  });

  window.addEventListener("touchmove", (e) => {
    if (dragging) onMove(e.touches[0].clientY);
  }, { passive: true });

  window.addEventListener("mousemove", (e) => {
    if (dragging) onMove(e.clientY);
  });

  window.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientY));
  window.addEventListener("mouseup", (e) => {
    if (dragging) onEnd(e.clientY);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobile() && sheetLevel !== "closed") closeSheet();
  });
}
