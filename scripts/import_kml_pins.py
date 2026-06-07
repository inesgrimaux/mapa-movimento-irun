import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

base = Path(__file__).resolve().parent.parent
ns = {"kml": "http://www.opengis.net/kml/2.2"}

FOLDER_TI = {
    "RMS E ILHA DE ITAPARICA": ["ti-26"],
    "BAIXO SUL": ["ti-06"],
    "LITORAL SUL": ["ti-05"],
    "RECÔNCAVO": ["ti-21"],
    "CHAPADA DIAMANTINA": ["ti-03"],
}

RMS_TI = {
    "Itaparica": "ti-26",
    "Mare de Março": "ti-26",
    "Salvador": "ti-26",
    "Associação Beneficente 25 de Junho": "ti-26",
    "Vera Cruz": "ti-26",
    "Quilombo do Tereré": "ti-26",
    "Museu de Memória Viva dos Quilombos do Tereré e Maragojipinho": "ti-26",
    "Vamos Navegar": "ti-26",
}

ENTIDADE = {
    "Itaparica": "itaparica",
    "Mare de Março": "itaparica",
    "Vera Cruz": "vera-cruz",
    "Quilombo do Tereré": "terere",
    "Museu de Memória Viva dos Quilombos do Tereré e Maragojipinho": "terere",
    "Vamos Navegar": "vera-cruz",
    "Comunidade Terreiro Caxuté": "caxute",
    "Museu da Costa do Dendê de Cultura Afro-Indígena": "museu-dende",
    "Festa das Rendeiras": "saubara",
    "Associação de Artesãos de Saubara": "saubara",
    "Casa das Rendeiras e Trançadeiras": "saubara",
}


def slugify(name):
    s = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s[:48] or "ponto"


def filter_links(links):
    blocked = ("designdialogico", "googleusercontent", "usercontent.google.com", "youtube.com/embed", "museudacostadodende.com")
    clean = [u for u in links if not any(b in u.lower() for b in blocked)]
    return clean[:3]


def extract_links(desc):
    if not desc:
        return []
    return list(dict.fromkeys(re.findall(r"https?://[^\s<\"'|]+", desc)))


def extract_text(desc):
    if not desc:
        return ""
    t = re.sub(r"<[^>]+>", " ", desc)
    t = re.sub(r"\s+", " ", t).strip()
    for u in extract_links(desc):
        t = t.replace(u, "").strip(" |")
    return t[:200]


def cats(name):
    n = name.lower()
    c = []
    if any(x in n for x in ["quilombo", "tereré", "terere", "barriguda"]):
        c += ["quilombos", "turismo"]
    if any(
        x in n
        for x in [
            "museu",
            "ponto de cultura",
            "associa",
            "escola",
            "colégio",
            "colegio",
            "secretaria",
            "grêmio",
            "gremio",
            "artesãos",
        ]
    ):
        c += ["instituicoes"]
    if any(
        x in n
        for x in [
            "valença",
            "valenca",
            "itaparica",
            "vera cruz",
            "salvador",
            "mucugê",
            "mucuge",
            "guiné",
            "guine",
            "serra grande",
        ]
    ):
        if "museu" not in n:
            c += ["municipios"]
    if any(
        x in n
        for x in [
            "maré",
            "mare",
            "vamos navegar",
            "25 de junho",
            "caxuté",
            "caxute",
            "festa",
            "revista",
            "casa azul",
        ]
    ):
        c += ["projetos"]
    if any(x in n for x in ["hostel", "marina", "pousada", "fonte", "ponte", "praia"]):
        c += ["turismo"]
    if "hostel" in n:
        c.append("producao")
    return list(dict.fromkeys(c)) or ["instituicoes"]


PIN_PATCH = {
    "Associação de Artesãos de Saubara": {
        "nome": "Casa das Rendeiras e Trançadeiras",
        "resumo": "Associação dos Artesãos de Saubara · Ponto de Cultura · renda de bilro e palha de Ouricuri",
        "categorias": ["instituicoes", "producao"],
        "links": ["https://casadasrendeiras.org.br/loja/"],
    },
    "Festa das Rendeiras": {
        "resumo": "Associação das Rendeiras de Saubara · @rendeirassaubara",
        "categorias": ["projetos", "instituicoes"],
    },
    "Comunidade Terreiro Caxuté": {
        "resumo": "Território bantu-ameríndia · Cajaíba, Maricoabo · ACULTEMA",
        "categorias": ["quilombos", "instituicoes", "projetos"],
    },
}


def parse_pins(kml_path):
    root = ET.parse(kml_path).getroot()
    by_ti = {}
    for folder in root.findall(".//kml:Folder", ns):
        fname = (folder.find("kml:name", ns).text or "").strip()
        tis = FOLDER_TI.get(fname, ["ti-26"])
        for pm in folder.findall("kml:Placemark", ns):
            name_el = pm.find("kml:name", ns)
            if name_el is None or not name_el.text:
                continue
            name = name_el.text.strip()
            if name.startswith("Line"):
                continue
            pt = pm.find(".//kml:Point/kml:coordinates", ns)
            if pt is None or not pt.text:
                continue
            lng, lat, *_ = [float(x) for x in pt.text.strip().split(",")]
            desc_el = pm.find("kml:description", ns)
            desc = desc_el.text if desc_el is not None and desc_el.text else ""
            ti = RMS_TI.get(name, tis[0]) if fname == "RMS E ILHA DE ITAPARICA" else tis[0]
            pid = slugify(name)
            p = {
                "id": pid,
                "nome": name,
                "coords": [lat, lng],
                "categorias": cats(name),
            }
            text = extract_text(desc)
            if text:
                p["resumo"] = text
            links = filter_links(extract_links(desc))
            if links:
                p["links"] = links
            if name in ENTIDADE and ENTIDADE[name]:
                p["entidadeId"] = ENTIDADE[name]
            if name in PIN_PATCH:
                p.update(PIN_PATCH[name])
                p["id"] = slugify(p["nome"])
            by_ti.setdefault(ti, [])
            if not any(x["id"] == p["id"] for x in by_ti[ti]):
                by_ti[ti].append(p)
    return by_ti


def parse_roteiro(kml_path):
    root = ET.parse(kml_path).getroot()
    paradas = []
    coords_line = []
    for pm in root.findall(".//kml:Placemark", ns):
        name_el = pm.find("kml:name", ns)
        name = name_el.text.strip() if name_el is not None and name_el.text else ""
        pt = pm.find(".//kml:Point/kml:coordinates", ns)
        line = pm.find(".//kml:LineString/kml:coordinates", ns)
        if pt is not None and pt.text and not name.startswith("Line"):
            lng, lat, *_ = [float(x) for x in pt.text.strip().split(",")]
            paradas.append(
                {
                    "id": slugify(name),
                    "nome": name,
                    "coords": [lat, lng],
                    "ordem": len(paradas) + 1,
                }
            )
        if line is not None and line.text:
            ring = []
            for part in line.text.strip().split():
                lng, lat, *_ = [float(x) for x in part.split(",")]
                ring.append([lng, lat])
            coords_line = ring
    return paradas, coords_line


EXTRA_PINS = {
    "ti-21": [
        {
            "id": "saubara",
            "nome": "Saubara",
            "coords": [-12.7411, -38.7672],
            "categorias": ["municipios"],
            "entidadeId": "saubara",
        },
        {
            "id": "casa-das-rendeiras-e-trancadeiras",
            "nome": "Casa das Rendeiras e Trançadeiras",
            "coords": [-12.7391106, -38.7628271],
            "categorias": ["instituicoes", "producao"],
            "resumo": "Associação dos Artesãos de Saubara · Ponto de Cultura · renda de bilro e palha de Ouricuri",
            "links": ["https://casadasrendeiras.org.br/loja/"],
            "entidadeId": "saubara",
        },
    ],
    "ti-06": [
        {
            "id": "kilombo-tenonde",
            "nome": "Kilombo Tenondé",
            "coords": [-13.3694, -39.0731],
            "categorias": ["quilombos", "instituicoes"],
            "entidadeId": "tenonde",
        }
    ],
}


def merge_extra_pins(by_ti):
    for ti, extras in EXTRA_PINS.items():
        by_ti.setdefault(ti, [])
        for p in extras:
            if not any(x["id"] == p["id"] for x in by_ti[ti]):
                by_ti[ti].insert(0, p)
    return by_ti


def main():
    pins = merge_extra_pins(parse_pins(base / "geo/import/5-territorios.kml"))
    for ti, pontos in sorted(pins.items()):
        out = base / f"data/pontos/{ti}.json"
        out.write_text(
            json.dumps({"territorioId": ti, "pontos": pontos}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"{ti}: {len(pontos)} pins")

    paradas, line = parse_roteiro(base / "geo/import/roteiro-contra-costa.kml")
    features = []
    if line:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": "contra-costa",
                    "tipo": "roteiro-linha",
                    "nome": "Contra Costa — Ilha de Itaparica",
                },
                "geometry": {"type": "LineString", "coordinates": line},
            }
        )
    for p in paradas:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": p["id"],
                    "tipo": "roteiro-parada",
                    "nome": p["nome"],
                    "ordem": p["ordem"],
                    "roteiroId": "contra-costa",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [p["coords"][1], p["coords"][0]],
                },
            }
        )
    roteiro_dir = base / "geo/roteiros"
    roteiro_dir.mkdir(parents=True, exist_ok=True)
    (roteiro_dir / "contra-costa.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"roteiro: {len(paradas)} paradas, linha {len(line)} pts")


if __name__ == "__main__":
    main()
