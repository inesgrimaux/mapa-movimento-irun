const EXPORT_EMAIL = "casadecastroalves@gmail.com";

export async function buildMapaExport() {
  const manifest = await fetch("data/manifest.json").then((r) => r.json());
  const [mapa, territoriosData, geoManifest] = await Promise.all([
    fetch("data/mapa.json").then((r) => r.json()),
    fetch("data/territorios.json").then((r) => r.json()),
    fetch("geo/manifest.json").then((r) => r.json()),
  ]);

  const entidades = {};
  for (const id of manifest.entidades || []) {
    entidades[id] = await fetch(`data/entidades/${id}.json`).then((r) => r.json());
  }

  const pontos = {};
  for (const id of manifest.pontos || []) {
    pontos[id] = await fetch(`data/pontos/${id}.json`).then((r) => r.json());
  }

  return {
    exportedAt: new Date().toISOString(),
    project: "MOVIMENTO IRUN — Mapa Territorial",
    version: manifest.version,
    manifest,
    mapa,
    territorios: territoriosData,
    geoManifest,
    entidades,
    pontos,
  };
}

export async function exportMapaJson({ openEmail = true } = {}) {
  const pack = await buildMapaExport();
  const json = JSON.stringify(pack, null, 2);
  const date = pack.exportedAt.slice(0, 10);
  const filename = `mapa-movimento-irun-${date}.json`;

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  if (openEmail) {
    const subject = encodeURIComponent(`Mapa MOVIMENTO IRUN — JSON ${date}`);
    const body = encodeURIComponent(
      `Exportação do mapa territorial MOVIMENTO IRUN.\n\n` +
        `Ficheiro: ${filename}\n` +
        `Data: ${pack.exportedAt}\n` +
        `Entidades REDE: ${(pack.manifest.entidades || []).join(", ")}\n\n` +
        `Anexe o ficheiro JSON descarregado a este email.`
    );
    window.location.href = `mailto:${EXPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return { filename, pack };
}
