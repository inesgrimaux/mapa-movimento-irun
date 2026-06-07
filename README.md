# Mapa Territorial MOVIMENTO IRUN

Mapa territorial interactivo da Bahia — 27 Territórios de Identidade e REDE Movimento Irun.

## Executar localmente

Requer servidor HTTP (módulos ES):

```bash
cd "MAPA MOVIMENTO IRUN"
python -m http.server 8080
```

Abrir: http://localhost:8080

## Estrutura

- `geo/manifest.json` — registo de camadas (KML futuros)
- `data/manifest.json` — registo de entidades JSON
- `data/territorios.json` — 27 Territórios de Identidade
- `geo/base/territorios.geojson` — polígonos SEI/SEPLAN

## Documentação

`../DOCUMENTACAO/ARQUITETURA_MAPA_MOVIMENTO_IRUN.md`

## Hospedagem

- **GitHub Pages (activo):** https://inesgrimaux.github.io/mapa-movimento-irun/
- **Produção (alvo):** upload da pasta para `casadecastroalves.com.br/territorios/`

Repositório: https://github.com/inesgrimaux/mapa-movimento-irun

### Imagem OG (WhatsApp, Facebook, LinkedIn, X)

- Ficheiro: `assets/og-mapa-bahia.png` (1200×630)
- Regenerar: `python scripts/generate_og.py`
- Ao publicar em `casadecastroalves.com.br/territorios/`, actualizar URLs em `index.html` e `data/mapa.json` (`siteBase`, `ogImage`, `canonical`)

## Nota — pasta antiga

Se ainda existir `ATLAS MOVIMENTO IRUN/` ao lado desta pasta, feche o Cursor e execute `../DOCUMENTACAO/remover-pasta-atlas.ps1` para apagar a cópia antiga.
