import { state, setSelectedTi, setSelectedEntity } from "./state.js";

export function parseRoute() {
  const hash = window.location.hash.slice(1) || "bahia";
  const [path, query] = hash.split("?");
  const parts = path.split("/").filter(Boolean);

  const filters = new URLSearchParams(query || "").get("f");
  if (filters) {
    state.filters = new Set(filters.split(",").filter(Boolean));
  }

  if (!parts.length || parts[0] === "bahia") {
    return { view: "bahia", tiId: null, entityId: null };
  }

  if (parts[0].startsWith("ti-")) {
    return {
      view: parts[1] ? "entity" : "ti",
      tiId: parts[0],
      entityId: parts[1] || null,
    };
  }

  return { view: "bahia", tiId: null, entityId: null };
}

export function buildHash({ view, tiId, entityId, filters }) {
  let path = "bahia";
  if (view === "ti" && tiId) path = tiId;
  if (view === "entity" && tiId && entityId) path = `${tiId}/${entityId}`;

  const f = filters?.size ? Array.from(filters).join(",") : "";
  return f ? `#${path}?f=${f}` : `#${path}`;
}

export function navigate(route) {
  const hash = buildHash({
    view: route.view,
    tiId: route.tiId,
    entityId: route.entityId,
    filters: state.filters,
  });
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
  if (route.tiId) setSelectedTi(route.tiId);
  else setSelectedTi(null);
  setSelectedEntity(route.entityId || null);
  return route;
}

export function initRouter(onRoute) {
  const handle = () => onRoute(parseRoute());
  window.addEventListener("hashchange", handle);
  handle();
}

export function goBahia() {
  navigate({ view: "bahia", tiId: null, entityId: null });
}

export function goTerritorio(tiId) {
  navigate({ view: "ti", tiId, entityId: null });
}

export function goEntity(tiId, entityId) {
  navigate({ view: "entity", tiId, entityId });
}
