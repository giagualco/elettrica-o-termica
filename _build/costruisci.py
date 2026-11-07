#!/usr/bin/env python3
"""Assembla ../index.html (file unico) da:
   - font e CSS del calcolatore CER (gemello per costruzione): stessa base degli altri strumenti
   - stile-extra.css
   - app.js
Uso: python3 _build/costruisci.py
"""
import os

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, ".."))
# La base CSS (con il font Space Grotesk incorporato) è quella dei calcolatori fratelli.
# Si prende dal primo che si trova: il CER sul disco di lavoro, poi il fotovoltaico accanto a questo repo.
CANDIDATI = [
    os.path.expanduser("~/Documents/Claude/Projects/PIANO DI COMUNICAZIONE/YOUTUBE/CALCOLATORE_CER/index.html"),
    os.path.join(RADICE, "..", "quanto-fotovoltaico-mi-serve", "index.html"),
]
sorgente_path = next((p for p in CANDIDATI if os.path.exists(p)), None)
if not sorgente_path:
    raise SystemExit("Non trovo la base CSS: serve il calcolatore CER o quanto-fotovoltaico-mi-serve accanto a questo repo.")
sorgente = open(sorgente_path, encoding="utf-8").read()
i_style = sorgente.index("<style>")
i_fine = sorgente.index("</style>")
css_base = sorgente[i_style + len("<style>"):i_fine]
extra = open(os.path.join(QUI, "stile-extra.css"), encoding="utf-8").read()
app = open(os.path.join(QUI, "app.js"), encoding="utf-8").read()

html = (
    "<!DOCTYPE html>\n<html lang=\"it\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    "<meta name=\"description\" content=\"Elettrica o termica? Il confronto su tutti gli anni di possesso: acquisto, carburante o ricarica, "
    "manutenzione, bollo, rivendita e CO2. Gratis, senza mail, senza tracciamento.\">\n"
    "<meta name=\"robots\" content=\"index,follow\">\n"
    "<title>Elettrica o termica? Il conto vero</title>\n"
    "<style>" + css_base + extra + "</style>\n</head>\n<body>\n"
    "<div class=\"wrap\" id=\"wrap\">\n  <div class=\"testata\">\n    <span class=\"marchio\">Elettrica o termica?</span>\n"
    "    <button type=\"button\" class=\"torna\" id=\"indietro-top\" hidden>&larr; Indietro</button>\n"
    "    <span class=\"contatore\" id=\"contatore\"></span>\n  </div>\n  <div class=\"barra\"><i id=\"barra\"></i></div>\n  <div id=\"palco\"></div>\n</div>\n"
    "<div id=\"stampa\"></div>\n\n<script>\n" + app + "\n</script>\n</body>\n</html>\n"
)
out = os.path.join(RADICE, "index.html")
open(out, "w", encoding="utf-8").write(html)
print("scritto", out, len(html.encode("utf-8")) // 1024, "KB — base CSS da", os.path.relpath(sorgente_path, RADICE))
