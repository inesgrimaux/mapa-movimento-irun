#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    errs = []
    for f in ROOT.rglob("*.json"):
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            errs.append(f"{f.relative_to(ROOT)}: {e}")

    for f in ROOT.rglob("*.js"):
        r = subprocess.run(["node", "--check", str(f)], capture_output=True)
        if r.returncode:
            errs.append(f"{f.relative_to(ROOT)}: JS syntax error")

    m = json.loads((ROOT / "data/manifest.json").read_text(encoding="utf-8"))
    for e in m.get("entidades", []):
        if not (ROOT / f"data/entidades/{e}.json").exists():
            errs.append(f"missing entidade: {e}")
    for p in m.get("pontos", []):
        if not (ROOT / f"data/pontos/{p}.json").exists():
            errs.append(f"missing pontos: {p}")
    for ro in m.get("roteiros", []):
        fp = ro.get("file")
        if fp and not (ROOT / fp).exists():
            errs.append(f"missing roteiro: {fp}")

    gm = json.loads((ROOT / "geo/manifest.json").read_text(encoding="utf-8"))
    for layer in gm.get("layers", []):
        fp = layer.get("file")
        if fp and not (ROOT / "geo" / fp).exists():
            errs.append(f"missing geo: {fp}")

    for pf in (ROOT / "data/pontos").glob("*.json"):
        data = json.loads(pf.read_text(encoding="utf-8"))
        for p in data.get("pontos", []):
            for slide in p.get("popup", {}).get("slides", []):
                foto = slide.get("foto")
                if foto and not (ROOT / foto).exists():
                    errs.append(f"missing asset {foto} ({p.get('id')})")

    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print("ALL OK")


if __name__ == "__main__":
    main()
