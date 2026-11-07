# Elettrica o termica? Il conto vero

Uno strumento gratuito del canale YouTube **Gianluca Gualco — Energia**. Il quarto, dopo il
calcolatore fotovoltaico, quello delle comunità energetiche e il verificatore del bonus colonnine.

Undici domande, una per schermata, e ti dice quale delle due auto costa meno **su tutti gli anni
in cui la tieni**: acquisto e incentivi, carburante o ricarica, manutenzione, assicurazione, bollo
e quello che ne ricavi rivendendola. Con il pareggio in anni, il costo al chilometro, i km all'anno
oltre i quali la risposta si ribalta e la CO₂.

**Non chiede la mail. Non registra niente. Non parla mai con la rete. Non ha niente da venderti.**

## Perché un altro confronto

Quasi tutti i confronti che girano guardano il pieno contro la ricarica, e la ricarica la fanno
sempre a casa, al prezzo più basso. Così l'elettrica vince sempre. Oppure guardano solo il prezzo
di listino, e allora vince sempre la termica.

Qui contano le due cose che spostano davvero il risultato:

- **dove ricarichi**: 100 km costano circa il doppio alla colonnina veloce rispetto alla luce di casa;
- **quanti chilometri fai**: la pagina ti dice la soglia oltre la quale conviene l'una o l'altra.

## Che cosa fa

- Corregge il consumo **WLTP** per il tipo di strada (in città la termica consuma di più, in
  autostrada l'elettrica) e per lo scostamento reale dal dato omologato.
- Calcola il prezzo dell'energia dell'elettrica come media pesata fra casa, colonnina lenta e veloce.
- Conta il **bollo** dalla potenza: le elettriche sono esenti per cinque anni, poi pagano un quarto.
- Stima il **valore di rivendita** con una svalutazione annua, più prudente per l'elettrica.
- Ricava i km annui, se vuoi, dalla **Cronologia di Google** (Takeout vecchio formato o export
  Spostamenti dal telefono), contando solo i tragitti in auto. Il file non lascia il dispositivo.
- Genera un **foglio da stampare** con il confronto, le ipotesi e sette domande da farsi
  rispondere per iscritto in concessionaria.

## Le fonti

Tutte le costanti stanno in [`parametri.json`](parametri.json) con fonte e data. Le principali:

- **Carburanti**: Osservatorio prezzi MIMIT, self service sulla rete stradale, 1° novembre 2026:
  benzina 2,010 €/L, gasolio 2,241 €/L.
- **Luce di casa**: ARERA, cliente vulnerabile in maggior tutela, IV trimestre 2026: 43,43 c€/kWh.
- **Colonnine**: listino Enel X Way Pay Per Use: 0,69 €/kWh in alternata, 0,89 in continua.
- **Percorrenza**: ISTAT, 10.231 km l'anno per le autovetture (anno 2021, pubblicato 2025).
- **CO₂ della rete**: ISPRA, rapporto 430/2026: 199,6 g/kWh per i consumi elettrici 2025.

Le voci segnate come **ipotesi** (correzioni per tipo di strada, manutenzione, svalutazione, quote
di ricarica) non sono misure: sono stime dichiarate, e nella pagina si cambiano tutte.

## Com'è fatto

Un file HTML unico, senza dipendenze, che funziona anche offline: `index.html`. Il font è
incorporato. È il gemello dei calcolatori precedenti: stesso CSS, stessa meccanica a passi, stesso
foglio stampabile.

Il file si **assembla** da `_build/`:

| File | Cosa fa |
|---|---|
| `_build/app.js` | tutta la logica: domande, conto, esito, carte scoperte, foglio |
| `_build/stile-extra.css` | il CSS in più rispetto ai calcolatori (tabella a tre colonne, grafico, caricamento file) |
| `_build/costruisci.py` | incolla font e CSS del calcolatore CER (o del fotovoltaico) e `app.js` in `index.html` |

```bash
python3 _build/costruisci.py
```

`streamlit_app.py` incorpora la stessa pagina, così che esista una versione sola da mantenere.

## Manutenzione

- **ogni mese**: prezzi dei carburanti MIMIT;
- **a ogni trimestre**: prezzo ARERA della luce;
- **quando cambia il listino**: colonnine pubbliche;
- **ogni anno**: fattore ISPRA della rete e percorrenze ISTAT.

Quando si aggiorna un numero in `parametri.json`, va aggiornato anche in `_build/app.js` e poi si
riassembla.

## Avvertenza

È una **stima, non un preventivo**. I prezzi restano quelli di oggi per tutto il periodo; non
sono conteggiati inflazione, finanziamento, wallbox e sostituzione della batteria fuori garanzia.

## Licenza

[MIT](LICENSE).
