import { state } from "../core/state.js";
import { richPopupHtml, initRichPopup, hasRichPopup } from "./popup-rich.js";

const TILES = {
  minimalLight: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    options: {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    },
  },
  minimalDark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    options: {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    },
  },
  normal: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    },
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    },
  },
};

const BAHIA_BOUNDS = [[-18.5, -46.8], [-8.5, -37.0]];
const BAHIA_CENTER = [-12.5, -41.5];

let map = null;
let baseLayer = null;
let tiLayer = null;
let redeLayerGroup = null;
let pinsLayerGroup = null;
let roteirosLayerGroup = null;
let entityLayerGroup = null;
let markerByPinId = {};
let layerById = {};
let redeLayerByEntity = {};
let onTiClick = null;
let onEntityClick = null;

function polygonStyles() {
  const dark = state.theme === "dark";
  return {
    default: {
      color: dark ? "#555555" : "#cccccc",
      weight: 1.2,
      fillColor: dark ? "#2a2a2a" : "#f0f0f0",
      fillOpacity: dark ? 0.85 : 0.7,
    },
    hover: {
      color: "#f5c518",
      weight: 2,
      fillColor: dark ? "#3d3520" : "#f5f0d0",
      fillOpacity: 0.55,
    },
    active: (redeAtiva) => ({
      color: redeAtiva ? "#f5c518" : dark ? "#f0f0f0" : "#111111",
      weight: redeAtiva ? 2.5 : 2,
      fillColor: "#f5c518",
      fillOpacity: 0.22,
    }),
    rede: (dark) => ({
      color: "#f5c518",
      weight: 1.8,
      fillColor: dark ? "#2a2a2a" : "#f0f0f0",
      fillOpacity: dark ? 0.85 : 0.7,
    }),
  };
}

function styleForLayer(id, rede) {
  const s = polygonStyles();
  if (state.selectedTiId === id) return s.active(rede);
  if (rede) return s.rede(state.theme === "dark");
  return s.default;
}

export function initMap(containerId, territorios, clickHandler, entityClickHandler) {
  onTiClick = clickHandler;
  onEntityClick = entityClickHandler;

  map = L.map(containerId, {
    zoomControl: false,
    minZoom: 6,
    maxBounds: [[-20, -50], [-7, -35]],
  }).setView(BAHIA_CENTER, 7);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  applyBaseLayer();

  map.on("keydown", (e) => {
    const step = 0.08;
    const c = map.getCenter();
    switch (e.originalEvent?.key) {
      case "ArrowUp": map.panTo([c.lat + step, c.lng]); break;
      case "ArrowDown": map.panTo([c.lat - step, c.lng]); break;
      case "ArrowLeft": map.panTo([c.lat, c.lng - step]); break;
      case "ArrowRight": map.panTo([c.lat, c.lng + step]); break;
      default: break;
    }
  });

  document.getElementById("map")?.setAttribute("tabindex", "0");

  return loadTerritorios(territorios);
}

async function loadTerritorios(territorios) {
  const res = await fetch("geo/base/territorios.geojson");
  const geo = await res.json();

  const redeMap = Object.fromEntries(territorios.map((t) => [t.id, t.redeAtiva]));
  const hover = () => polygonStyles().hover;

  tiLayer = L.geoJSON(geo, {
    style: (feature) => styleForLayer(feature.properties.id, redeMap[feature.properties.id]),
    onEachFeature: (feature, layer) => {
      const { id, cod, nome } = feature.properties;
      layerById[id] = layer;

      layer.bindPopup(
        `<div class="popup-title">${cod} — ${nome}</div>
         <div class="popup-cod">Território de Identidade</div>
         <span class="popup-link" data-ti="${id}">Ver ficha →</span>`,
        { maxWidth: 260, className: "irun-popup" }
      );

      layer.on({
        mouseover: (e) => {
          if (state.selectedTiId !== id) e.target.setStyle(hover());
        },
        mouseout: (e) => {
          if (state.selectedTiId !== id) e.target.setStyle(styleForLayer(id, redeMap[id]));
        },
        click: () => onTiClick?.(id),
      });
    },
  }).addTo(map);

  map.fitBounds(BAHIA_BOUNDS, { padding: [20, 20] });

  map.on("popupopen", (e) => {
    initRichPopup(e.popup.getElement());
  });

  map.getContainer().addEventListener("click", (ev) => {
    const link = ev.target.closest(".popup-link[data-ti]");
    if (!link || link.tagName === "A") return;
    ev.preventDefault();
    if (link.dataset.entity) onEntityClick?.(link.dataset.ti, link.dataset.entity);
    else onTiClick?.(link.dataset.ti);
    map.closePopup();
  });

  return map;
}

function resolveTileKey() {
  if (state.mapBaseMode === "satellite") return "satellite";
  if (state.mapBaseMode === "normal") return "normal";
  return state.theme === "dark" ? "minimalDark" : "minimalLight";
}

export function applyBaseLayer() {
  if (!map) return;
  if (baseLayer) map.removeLayer(baseLayer);
  const key = resolveTileKey();
  const t = TILES[key];
  baseLayer = L.tileLayer(t.url, t.options).addTo(map);
}

export function setBaseLayer(mode) {
  state.mapBaseMode = mode;
  applyBaseLayer();
}

export function refreshMapTheme() {
  if (!map) return;
  applyBaseLayer();
  refreshStyles();
}

export function highlightTerritorio(tiId) {
  if (!tiLayer) return;

  tiLayer.eachLayer((layer) => {
    const id = layer.feature.properties.id;
    const rede = state.territorios.find((t) => t.id === id)?.redeAtiva;
    if (id === tiId) {
      layer.setStyle(polygonStyles().active(rede));
      layer.bringToFront();
      map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 9 });
    } else {
      layer.setStyle(styleForLayer(id, rede));
    }
  });
}

export function resetView() {
  if (!map || !tiLayer) return;
  tiLayer.eachLayer((layer) => {
    const id = layer.feature.properties.id;
    const rede = state.territorios.find((t) => t.id === id)?.redeAtiva;
    layer.setStyle(styleForLayer(id, rede));
  });
  map.fitBounds(BAHIA_BOUNDS, { padding: [20, 20] });
}

export function getMap() {
  return map;
}

export function refreshStyles() {
  if (!tiLayer) return;
  tiLayer.eachLayer((layer) => {
    const id = layer.feature.properties.id;
    const rede = state.territorios.find((t) => t.id === id)?.redeAtiva;
    layer.setStyle(styleForLayer(id, rede));
  });
  refreshOverlayVisibility();
}

function pinIcon(active = false) {
  return L.divIcon({
    className: "irun-pin",
    html: `<span class="irun-pin-dot${active ? " active" : ""}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function entityIcon(active = false) {
  return L.divIcon({
    className: "irun-entity-pin",
    html: `<span class="irun-entity-dot${active ? " active" : ""}">●</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function redeStyle() {
  const dark = state.theme === "dark";
  return {
    color: "#f5c518",
    weight: 2.2,
    fillColor: dark ? "#3d3520" : "#f5f0d0",
    fillOpacity: 0.35,
    dashArray: "6 4",
  };
}

function matchesFilters(categorias = []) {
  if (!state.filters.size) return true;
  return categorias.some((c) => state.filters.has(c));
}

export async function loadRedeLayers(geoManifest) {
  if (!map || !geoManifest?.layers?.length) return;
  if (redeLayerGroup) map.removeLayer(redeLayerGroup);
  redeLayerGroup = L.layerGroup().addTo(map);
  redeLayerByEntity = {};

  const active = geoManifest.layers.filter((layer) => layer.status === "active");
  const geos = await Promise.all(
    active.map((layer) => fetch(`geo/${layer.file}`).then((res) => res.json()))
  );

  active.forEach((layer, i) => {
    const geo = geos[i];
    const lg = L.geoJSON(geo, {
      filter: (f) => f.geometry.type !== "Point",
      style: () => redeStyle(),
      onEachFeature: (feature, l) => {
        const nome = feature.properties?.nome || "";
        if (nome) l.bindPopup(`<div class="popup-title">${escHtml(nome)}</div>`);
        l._irunCats = ["quilombos"];
      },
    });
    lg.addTo(redeLayerGroup);
    redeLayerByEntity[layer.entidadeId] = lg;
  });
  refreshOverlayVisibility();
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function bestLink(links = []) {
  const clean = links.filter(
    (u) => !/designdialogico|googleusercontent|usercontent\.google\.com|gstatic/i.test(u)
  );
  return (
    clean.find((u) => /youtube\.com|kilombotenonde|instagram\.com/i.test(u)) ||
    clean[0]
  );
}

function pinPopupHtml(p, tiId) {
  if (hasRichPopup(p)) {
    return richPopupHtml(p, tiId);
  }
  const link = bestLink(p.links);
  return `<div class="popup-title">${escHtml(p.nome)}</div>
    ${p.resumo ? `<div class="popup-cod">${escHtml(p.resumo)}</div>` : ""}
    ${link ? `<a class="popup-link" href="${escHtml(link)}" target="_blank" rel="noopener">Saiba mais →</a>` : ""}
    ${p.entidadeId ? `<span class="popup-link" data-entity="${p.entidadeId}" data-ti="${tiId}">Ver ficha →</span>` : ""}`;
}

function pinPopupOptions(p) {
  return hasRichPopup(p)
    ? { maxWidth: 340, minWidth: 280, className: "irun-popup irun-popup-rich-wrap" }
    : { maxWidth: 260, className: "irun-popup" };
}

export async function loadPontos(pontosFiles, prefetched = null) {
  if (!map) return;
  if (pinsLayerGroup) map.removeLayer(pinsLayerGroup);
  pinsLayerGroup = L.layerGroup().addTo(map);
  state.pontos = [];
  markerByPinId = {};

  const batches =
    prefetched ||
    (await Promise.all(
      pontosFiles.map((file) => fetch(`data/pontos/${file}.json`).then((r) => r.json()))
    ));

  for (const data of batches) {
    for (const p of data.pontos || []) {
      const pin = { ...p, territorioId: data.territorioId };
      state.pontos.push(pin);
      const marker = L.marker(p.coords, { icon: pinIcon() });
      marker._irunCats = p.categorias || ["quilombos"];
      marker._irunId = p.id;
      marker.bindPopup(pinPopupHtml(p, data.territorioId), pinPopupOptions(p));
      marker.addTo(pinsLayerGroup);
      markerByPinId[p.id] = marker;
    }
  }

  refreshOverlayVisibility();
}

export async function loadRoteiros(roteiros) {
  if (!map || !roteiros?.length) return;
  if (roteirosLayerGroup) map.removeLayer(roteirosLayerGroup);
  roteirosLayerGroup = L.layerGroup().addTo(map);

  for (const r of roteiros) {
    if (!r.file) continue;
    const geo = await fetch(r.file).then((res) => res.json());
    L.geoJSON(geo, {
      filter: (f) => f.geometry.type === "LineString",
      style: () => ({
        color: "#f5c518",
        weight: 3,
        opacity: 0.85,
        dashArray: "8 6",
      }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<div class="popup-title">${escHtml(r.titulo)}</div><div class="popup-cod">Roteiro · Turismo</div>`);
        layer._irunCats = ["turismo", "projetos"];
      },
    }).addTo(roteirosLayerGroup);

    L.geoJSON(geo, {
      filter: (f) => f.geometry.type === "Point",
      pointToLayer: (f, latlng) => L.marker(latlng, { icon: pinIcon() }),
      onEachFeature: (feature, layer) => {
        const nome = feature.properties?.nome || "Parada";
        const ordem = feature.properties?.ordem || "";
        layer.bindPopup(
          `<div class="popup-title">${escHtml(nome)}</div>
           <div class="popup-cod">Parada ${ordem} · ${escHtml(r.titulo)}</div>`
        );
        layer._irunCats = ["turismo", "projetos"];
      },
    }).addTo(roteirosLayerGroup);
  }
  refreshOverlayVisibility();
}

export function updateEntityMarkerSelection() {
  if (!entityLayerGroup) return;
  entityLayerGroup.eachLayer((layer) => {
    layer.setIcon(entityIcon(layer._entityId === state.selectedEntityId));
  });
}

export function loadEntityMarkers(entidades) {
  if (!map) return;
  if (entityLayerGroup) map.removeLayer(entityLayerGroup);
  entityLayerGroup = L.layerGroup().addTo(map);

  for (const e of entidades) {
    const [lat, lng] = e.meta?.coords || [];
    if (!lat || !lng) continue;
    const active = state.selectedEntityId === e.id;
    const marker = L.marker([lat, lng], { icon: entityIcon(active) });
    marker._irunCats = ["quilombos"];
    marker._entityId = e.id;
    marker._tiId = e.territorioId;
    marker.bindPopup(
      `<div class="popup-title">${e.meta.nome}</div>
       <div class="popup-cod">${e.tipo === "quilombo" ? "Quilombo · REDE" : e.tipo === "municipio" ? "Município · REDE" : "REDE"}</div>
       <span class="popup-link" data-entity="${e.id}" data-ti="${e.territorioId}">Abrir ficha →</span>`
    );
    marker.on("click", () => onEntityClick?.(e.territorioId, e.id));
    marker.addTo(entityLayerGroup);
  }

  refreshOverlayVisibility();
}

export function refreshOverlayVisibility() {
  const toggle = (layer, visible) => {
    if (layer.setOpacity) layer.setOpacity(visible ? 1 : 0);
    if (layer.setStyle && layer.feature?.geometry?.type === "Polygon") {
      if (visible) layer.setStyle(redeStyle());
      else layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
    }
    const el = layer.getElement?.();
    if (el) {
      el.style.display = visible ? "" : "none";
      el.style.pointerEvents = visible ? "" : "none";
    }
  };

  [redeLayerGroup, pinsLayerGroup, entityLayerGroup, roteirosLayerGroup].forEach((group) => {
    if (!group) return;
    group.eachLayer((layer) => {
      const cats = layer._irunCats || ["quilombos"];
      toggle(layer, matchesFilters(cats));
    });
  });
}

export function focusPin(coords, zoom = 14) {
  if (!map || !coords?.length) return;
  map.setView(coords, zoom, { animate: true });
}

export function openPinPopup(pinId) {
  markerByPinId[pinId]?.openPopup();
}

export function focusEntity(entity) {
  if (!map || !entity?.meta?.coords) return;
  const [lat, lng] = entity.meta.coords;
  map.setView([lat, lng], 14, { animate: true });

  const rede = redeLayerByEntity[entity.id];
  if (rede) {
    try {
      map.fitBounds(rede.getBounds(), { padding: [60, 60], maxZoom: 15 });
    } catch {
      map.setView([lat, lng], 14);
    }
  }

  updateEntityMarkerSelection();
}

export { layerById, redeLayerByEntity };
