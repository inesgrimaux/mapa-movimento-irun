import { state, subscribe, countRedeAtiva, setSelectedTi, setSelectedEntity, setMapBaseMode } from "./core/state.js";
import { initRouter, goTerritorio, goEntity, parseRoute } from "./core/router.js";
import {
  initMap, applyBaseLayer, highlightTerritorio, resetView, refreshStyles, getMap,
  loadRedeLayers, loadPontos, loadRoteiros, loadEntityMarkers, updateEntityMarkerSelection,
  focusEntity, refreshOverlayVisibility,
} from "./map/map.js";
import { renderSidebar, initSidebarKeyboard, openRedePanel } from "./sidebar/sidebar.js";
import { initPhotoLightbox } from "./sidebar/slideshow.js";
import { initShare } from "./share.js";
import { initTheme } from "./theme.js";
import { initShell, openSheetForTerritory } from "./shell.js";
import { initSearch } from "./search.js";

async function loadData() {
  const [mapa, territoriosData, dataManifest, geoManifest, territoriosGeo] = await Promise.all([
    fetch("data/mapa.json").then((r) => r.json()),
    fetch("data/territorios.json").then((r) => r.json()),
    fetch("data/manifest.json").then((r) => r.json()),
    fetch("geo/manifest.json").then((r) => r.json()),
    fetch("geo/base/territorios.geojson").then((r) => r.json()),
  ]);

  state.mapa = mapa;
  state.territorios = territoriosData.territorios;
  state.geoManifest = geoManifest;

  const entidades = await Promise.all(
    (dataManifest.entidades || []).map((id) =>
      fetch(`data/entidades/${id}.json`).then((r) => r.json())
    )
  );
  state.entidades = entidades;
  for (const e of entidades) {
    const ti = state.territorios.find((t) => t.id === e.territorioId);
    if (ti) ti.redeAtiva = true;
  }

  const pontosData = await Promise.all(
    (dataManifest.pontos || []).map((id) =>
      fetch(`data/pontos/${id}.json`).then((r) => r.json())
    )
  );
  for (const data of pontosData) {
    const ti = state.territorios.find((t) => t.id === data.territorioId);
    if (ti && data.pontos?.length) ti.redeAtiva = true;
  }

  document.getElementById("footer-text").textContent = mapa.footer;
  document.title = `${mapa.title} — ${mapa.subtitle}`;
  updateRedeBadge();

  return { dataManifest, pontosData, territoriosGeo };
}

function updateRedeBadge() {
  const el = document.getElementById("btn-rede-badge");
  if (el) el.textContent = `REDE ${countRedeAtiva()}/${state.mapa?.redeMeta || 27}`;
}

function handleRoute(route) {
  setSelectedTi(route.tiId || null);
  setSelectedEntity(route.entityId || null);
  renderSidebar(route);

  if (route.view === "entity" && route.entityId) {
    const ti = state.territorios.find((t) => t.id === route.tiId);
    const ent = state.entidades.find((e) => e.id === route.entityId);
    if (ti) highlightTerritorio(ti.id);
    if (ent) focusEntity(ent);
    openSheetForTerritory();
  } else if (route.tiId) {
    highlightTerritorio(route.tiId);
    openSheetForTerritory();
  } else {
    resetView();
  }

  refreshStyles();
  updateEntityMarkerSelection();
  updateRedeBadge();
}

async function main() {
  const { dataManifest, pontosData, territoriosGeo } = await loadData();

  initShell();
  initPhotoLightbox();
  initTheme();

  await initMap("map", state.territorios, (tiId) => {
    goTerritorio(tiId);
    openSheetForTerritory();
  }, (tiId, entityId) => {
    goEntity(tiId, entityId);
    openSheetForTerritory();
  }, territoriosGeo);

  await Promise.all([
    loadRedeLayers(state.geoManifest),
    loadPontos(dataManifest.pontos || [], pontosData),
    loadRoteiros(dataManifest.roteiros || []),
  ]);
  loadEntityMarkers(state.entidades);

  initSearch();
  initSidebarKeyboard();
  initMapModes();
  initRedeBadge();
  initShare();
  initRouter(handleRoute);

  getMap()?.invalidateSize();

  subscribe(() => {
    refreshOverlayVisibility();
    if (parseRoute().tiId === state.selectedTiId) refreshStyles();
  });
}

function initMapModes() {
  document.querySelectorAll(".map-mode[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".map-mode[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setMapBaseMode(btn.dataset.mode);
      applyBaseLayer();
    });
  });
}

function initRedeBadge() {
  document.getElementById("btn-rede-badge")?.addEventListener("click", openRedePanel);
}

main().catch((err) => {
  console.error(err);
  document.getElementById("sidebar-content").innerHTML =
    `<p class="lead">Erro ao carregar o mapa. Recarregue a página.</p>`;
});
