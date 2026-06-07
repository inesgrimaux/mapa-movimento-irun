const listeners = new Set();

export const state = {
  mapa: null,
  territorios: [],
  entidades: [],
  pontos: [],
  geoManifest: null,
  selectedTiId: null,
  selectedEntityId: null,
  filters: new Set(),
  theme: "light",
  mapBaseMode: "minimal",
  sidebarOpen: false,
  sidebarCollapsed: false,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(state));
}

export function setSelectedTi(id) {
  state.selectedTiId = id;
  if (!id) state.selectedEntityId = null;
  notify();
}

export function setSelectedEntity(id) {
  state.selectedEntityId = id;
  notify();
}

export function getEntidade(id) {
  return state.entidades.find((e) => e.id === id);
}

export function toggleFilter(key) {
  const next = new Set(state.filters);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  state.filters = next;
  notify();
}

export function setMapBaseMode(mode) {
  state.mapBaseMode = mode;
  notify();
}

export function setSidebarOpen(open) {
  state.sidebarOpen = open;
  notify();
}

export function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  notify();
}

export function countRedeAtiva() {
  return state.territorios.filter((t) => t.redeAtiva).length;
}

export function getTerritorio(id) {
  return state.territorios.find((t) => t.id === id);
}
