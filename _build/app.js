(function(){
"use strict";

/* =====================================================================
   ELETTRICA O TERMICA? — il conto su tutti gli anni, non sul pieno.
   Quarto strumento gratuito del canale «Gianluca Gualco — Energia».
   File unico, nessuna dipendenza, nessun tracciamento, funziona offline.
   ES5 di proposito: deve girare anche su televisori e telefoni vecchi.
   ===================================================================== */

var CANALE="https://www.youtube.com/@gianlucagualcoenergia?sub_confirmation=1";
var FOTOVOLTAICO="https://giagualco.github.io/quanto-fotovoltaico-mi-serve/";
var NOMEFILE="elettrica-o-termica-il-mio-confronto";

/* ==================== COSTANTI, OGNUNA CON LA SUA FONTE ====================
   Replicate in parametri.json, che è la fonte di verità documentale. Quando si
   aggiorna il JSON va aggiornato anche questo blocco: la pagina deve restare un
   file unico che funziona anche senza rete. */

/* Carburanti: prezzo medio self service sulla rete stradale, Osservatorio prezzi
   MIMIT, rilevazione del 1° novembre 2026. Cambia ogni giorno: è la costante che
   invecchia per prima. */
var P_BENZINA=2.010, P_GASOLIO=2.241;

/* Luce di casa: ARERA, cliente tipo vulnerabile in maggior tutela, IV trimestre 2026
   (dal 1° ottobre), imposte incluse: 43,43 c€/kWh, +37,3% sul trimestre prima.
   Sul mercato libero si trova di meno: per questo è modificabile. */
var P_CASA=0.4343;

/* Colonnina pubblica: listino Enel X Way, Pay Per Use senza abbonamento, IVA inclusa:
   0,69 €/kWh in corrente alternata, 0,89 in continua fino a 150 kW. */
var P_AC=0.69, P_DC=0.89;

/* Percorrenza: ISTAT, «Le percorrenze dei veicoli stradali circolanti», anno 2021
   (giugno 2025): 10.231 km l'anno per l'insieme delle autovetture. */
var KM_ISTAT=10231;

/* CO2 di sola combustione, così il confronto è alla pari con il fattore ISPRA della
   rete, che conta le centrali e non l'estrazione del gas. Benzina e gasolio: fattori
   di combustione medi (circa 2,33 e 2,65 kg per litro). Rete: ISPRA, rapporto 430/2026,
   fattore dei consumi elettrici 2025 = 199,6 g CO2/kWh. */
var CO2_BENZINA=2.33, CO2_GASOLIO=2.65, CO2_RETE=0.1996;

/* Bollo, tariffa ordinaria per le Euro 4-6: 2,58 €/kW fino a 100 kW, 3,87 €/kW oltre.
   Elettriche: esenti per i primi 5 anni dall'immatricolazione, poi un quarto della
   tariffa (in alcune regioni, come Piemonte e Lombardia, le regole sono più favorevoli). */
var BOLLO_KW=2.58, BOLLO_KW_OLTRE=3.87, BOLLO_ESENZIONE_EL=5, BOLLO_QUOTA_EL=0.25;

/* Quanto cambia il consumo rispetto al WLTP nei tre tipi di percorso. Sono IPOTESI:
   le termiche consumano di più in città, le elettriche in autostrada (alla velocità
   conta l'aria e manca il recupero in frenata). Normalizzate sul mix misto, così con
   quel mix il consumo resta il dato WLTP. */
var MOLT={
  benzina:{citta:1.15,extra:0.90,auto:1.05},
  gasolio:{citta:1.15,extra:0.90,auto:1.00},
  ibrida: {citta:0.85,extra:0.95,auto:1.20},
  el:     {citta:0.80,extra:0.95,auto:1.30}
};
var MIX={
  citta:{citta:.60,extra:.30,auto:.10},
  misto:{citta:.35,extra:.35,auto:.30},
  auto: {citta:.15,extra:.30,auto:.55}
};
/* Dove si ricarica: quote casa / colonnina lenta / colonnina veloce. Ipotesi che
   discendono dalla risposta, dichiarate e modificabili. */
var RICARICA={
  casa:  {casa:.90,ac:.10,dc:0},
  misto: {casa:.50,ac:.35,dc:.15},
  fuori: {casa:0,  ac:.60,dc:.40}
};

var S={
  iscritto:null, tipoT:null, prezzoT:24000, consT:6.0, unitaT:"l100",
  prezzoE:34000, incentivo:0, consE:16.5, km:KM_ISTAT, percorso:null, ricarica:null, anni:8,
  /* carte scoperte */
  pBenz:P_BENZINA, pGas:P_GASOLIO, pCasa:P_CASA, pAC:P_AC, pDC:P_DC,
  quotaCasa:null, quotaDC:null,
  scostT:15, scostE:15,
  manT:null, manE:350, assT:500, assE:500,
  kwT:74, kwE:110, svalT:12, svalE:15,
  co2B:CO2_BENZINA, co2G:CO2_GASOLIO, co2R:CO2_RETE,
  kmDaFile:null
};

/* ==================== FORMATTAZIONE ==================== */
function num(n,d){
  d=d||0; var neg=n<0; n=Math.abs(n);
  var p=n.toFixed(d).split("."),i=p[0],o="";
  for(var k=0;k<i.length;k++){ if(k>0&&(i.length-k)%3===0)o+="."; o+=i[k]; }
  return (neg?"−":"")+o+(p[1]?","+p[1]:"");
}
var eur=function(n){return num(Math.round(n))+" €"};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function anni(a){ return a===null ? "mai, nel periodo" : num(a,1)+" anni"; }

/* ==================== IL CONTO ==================== */
function fattore(tipo,mix){
  var m=MOLT[tipo], r=MIX.misto;
  return (m.citta*mix.citta+m.extra*mix.extra+m.auto*mix.auto)/(m.citta*r.citta+m.extra*r.extra+m.auto*r.auto);
}
function quote(){
  var q=RICARICA[S.ricarica||"casa"];
  var casa = S.quotaCasa!==null ? S.quotaCasa : q.casa;
  var dcSuFuori = q.ac+q.dc>0 ? q.dc/(q.ac+q.dc) : 0;
  var dc = S.quotaDC!==null ? S.quotaDC : dcSuFuori;
  return {casa:casa, ac:(1-casa)*(1-dc), dc:(1-casa)*dc, dcSuFuori:dc};
}
function tariffaBollo(kw){ return Math.min(kw,100)*BOLLO_KW + Math.max(kw-100,0)*BOLLO_KW_OLTRE; }
function manTermica(){ return S.manT!==null ? S.manT : (S.tipoT==="ibrida"?500:600); }

/* km come parametro: serve anche per trovare la soglia di convenienza */
function calcola(km){
  if(km===undefined) km=S.km;
  var mix=MIX[S.percorso||"misto"], q=quote(), n=Math.max(1,Math.round(S.anni));
  var tipo=S.tipoT||"benzina";

  var cT=S.consT*fattore(tipo,mix)*(1+S.scostT/100);
  var pT= tipo==="gasolio" ? S.pGas : S.pBenz;
  var cE=S.consE*fattore("el",mix)*(1+S.scostE/100);
  var pE=q.casa*S.pCasa+q.ac*S.pAC+q.dc*S.pDC;

  var T={nome:"Termica", consumo:cT, prezzoUnita:pT,
         energia:km/100*cT*pT, man:manTermica(), ass:S.assT,
         esborso:S.prezzoT, co2:km/100*cT*(tipo==="gasolio"?S.co2G:S.co2B)};
  var E={nome:"Elettrica", consumo:cE, prezzoUnita:pE,
         energia:km/100*cE*pE, man:S.manE, ass:S.assE,
         esborso:Math.max(0,S.prezzoE-S.incentivo), co2:km/100*cE*S.co2R};

  T.residuo=S.prezzoT*Math.pow(1-S.svalT/100,n);
  E.residuo=S.prezzoE*Math.pow(1-S.svalE/100,n);

  var bT=tariffaBollo(S.kwT), bE=tariffaBollo(S.kwE)*BOLLO_QUOTA_EL;
  T.cum=[T.esborso]; E.cum=[E.esborso]; T.bollo=0; E.bollo=0;
  for(var a=1;a<=n;a++){
    var beA = a<=BOLLO_ESENZIONE_EL ? 0 : bE;
    T.bollo+=bT; E.bollo+=beA;
    T.cum.push(T.cum[a-1]+T.energia+T.man+T.ass+bT);
    E.cum.push(E.cum[a-1]+E.energia+E.man+E.ass+beA);
  }
  T.bolloAnno=bT; E.bolloAnno=bE;
  [T,E].forEach(function(x){
    x.annuo=x.energia+x.man+x.ass;   /* senza bollo, che per l'elettrica cambia nel tempo */
    x.spese=x.cum[n]-x.esborso;
    x.tco=x.cum[n]-x.residuo;
    x.alKm= km>0 ? x.tco/(km*n) : 0;
    x.per100=x.consumo*x.prezzoUnita;
  });
  return {T:T,E:E,n:n,km:km,q:q,pareggio:pareggio(T,E,n)};
}

/* l'anno (con i decimali) in cui la spesa cumulata dell'auto più cara all'acquisto
   scende sotto quella dell'altra; null se non succede nel periodo */
function pareggio(T,E,n){
  if(T.esborso===E.esborso) return null;
  var cara = E.esborso>T.esborso ? E : T, altra = cara===E ? T : E;
  for(var a=1;a<=n;a++){
    var d0=cara.cum[a-1]-altra.cum[a-1], d1=cara.cum[a]-altra.cum[a];
    if(d0>0 && d1<=0) return {anni:a-1+d0/(d0-d1), chi:cara};
  }
  return null;
}

/* il costo totale è lineare nei km: due punti bastano per trovare dove si incrociano */
function sogliaKm(){
  var a=calcola(0), b=calcola(10000);
  var dA=a.E.tco-a.T.tco, dB=b.E.tco-b.T.tco, pend=(dB-dA)/10000;
  if(Math.abs(pend)<1e-9) return null;
  var k=-dA/pend;
  return k>0 && k<200000 ? {km:k, sopraVince:pend<0?"Elettrica":"Termica"} : null;
}

/* ==================== GOOGLE TAKEOUT ==================== */
var AUTO_TK={"IN_PASSENGER_VEHICLE":1,"IN_VEHICLE":1,"DRIVING":1,"IN_TAXI":1,
             "in passenger vehicle":1,"in vehicle":1,"driving":1,"in taxi":1};
function kmDaTakeout(d){
  var km=0, date=[];
  function dt(v){ var t=v?Date.parse(v):NaN; if(!isNaN(t)) date.push(t); }
  (d.timelineObjects||[]).forEach(function(o){
    var s=o.activitySegment; if(!s) return;
    if(AUTO_TK[s.activityType]) km+=(s.distance||0)/1000;
    var du=s.duration||{}; dt(du.startTimestamp); dt(du.endTimestamp);
  });
  (d.semanticSegments||[]).forEach(function(s){
    dt(s.startTime); dt(s.endTime);
    var a=s.activity; if(!a) return;
    var t=(a.topCandidate||{}).type;
    if(AUTO_TK[t]) km+=(a.distanceMeters||0)/1000;
  });
  return {km:km, da:date.length?Math.min.apply(null,date):null, a:date.length?Math.max.apply(null,date):null};
}

/* ==================== LE DOMANDE ==================== */
var PASSI=[
 {id:"iscritto", tipo:"singola", campo:"iscritto",
  titolo:"Sei iscritto al canale?",
  aiuto:"Questo strumento è gratuito e resta gratuito: non chiede la mail, non traccia e non ha niente da venderti. Se ti è utile, iscriverti è il modo per dirmelo.",
  opzioni:[{v:"si",t:"Sì, sono già iscritto"},
           {v:"no",t:"Non ancora",s:"Apro il canale in una nuova scheda e tu prosegui da qui"}]},

 {id:"tipoT", tipo:"singola", campo:"tipoT",
  titolo:"L'auto termica da confrontare, come va?",
  aiuto:"Quella che hai oggi o quella che stai guardando. L'<strong>ibrida</strong> qui è la full hybrid a benzina, che si ricarica da sola: le plug-in sono un'altra storia.",
  opzioni:[{v:"benzina",t:"A benzina"},
           {v:"gasolio",t:"A gasolio"},
           {v:"ibrida",t:"Ibrida, full hybrid",s:"Toyota, Honda, Renault E-Tech e simili: va a benzina"}]},

 {id:"prezzoT", tipo:"numero", campo:"prezzoT", unita:"€",
  titolo:"Quanto costa la termica?",
  aiuto:"Il prezzo che pagheresti davvero, sconti compresi. Se è l'auto che hai già, metti quanto ne prenderesti oggi vendendola: è quello che rinunci a incassare tenendola."},

 {id:"consT", tipo:"consumo",
  titolo:"Quanto consuma?",
  aiuto:"Il dato <strong>WLTP</strong> della scheda tecnica, quello del libretto o del configuratore. La correzione per la strada vera la faccio io, dopo."},

 {id:"prezzoE", tipo:"numero", campo:"prezzoE", unita:"€",
  titolo:"Quanto costa l'elettrica?",
  aiuto:"Il prezzo di listino meno gli sconti del concessionario. Gli incentivi statali me li dici alla prossima domanda, a parte."},

 {id:"incentivo", tipo:"numero", campo:"incentivo", unita:"€",
  titolo:"Hai incentivi o bonus sull'elettrica?",
  aiuto:"Se non ne hai, lascia zero. Mettili <strong>solo se sei sicuro di averne diritto</strong>: i fondi statali di solito si esauriscono in pochi giorni."},

 {id:"consE", tipo:"numero", campo:"consE", unita:"kWh/100 km", passo:0.1,
  titolo:"Quanto consuma l'elettrica?",
  aiuto:"Il dato <strong>WLTP</strong> in kWh ogni 100 km. Le compatte stanno fra 14 e 17, i SUV grandi fra 18 e 22. Se lo trovi in Wh/km, dividi per 10."},

 {id:"km", tipo:"numero", campo:"km", unita:"km all'anno",
  titolo:"Quanti chilometri fai in un anno?",
  aiuto:"È il numero che sposta di più il risultato. Se non lo sai, guarda i due ultimi tagliandi o la revisione. La media italiana è <strong>10.231 km</strong> (ISTAT)."},

 {id:"percorso", tipo:"singola", campo:"percorso",
  titolo:"Che strade fai, soprattutto?",
  aiuto:"Conta più di quanto si pensi: in città l'elettrica recupera energia in ogni frenata, in autostrada no, e a 130 all'ora consuma un terzo in più.",
  opzioni:[{v:"citta",t:"Soprattutto città",s:"Casa-lavoro in città, traffico, semafori"},
           {v:"misto",t:"Un po' di tutto",s:"Città, statali e qualche tratto di autostrada"},
           {v:"auto",t:"Soprattutto autostrada",s:"Trasferte e lunghi tragitti"}]},

 {id:"ricarica", tipo:"singola", campo:"ricarica",
  titolo:"Dove la ricaricheresti?",
  aiuto:"È la risposta che decide il prezzo dell'elettrica. A casa paghi la luce di casa; alla colonnina veloce paghi il doppio, e a volte di più.",
  opzioni:[{v:"casa",t:"Quasi sempre a casa",s:"Box o posto auto con una presa o una wallbox"},
           {v:"misto",t:"Un po' a casa, un po' fuori",s:"Casa, lavoro, supermercato, qualche colonnina veloce"},
           {v:"fuori",t:"Non ho dove ricaricare a casa",s:"Solo colonnine pubbliche"}]},

 {id:"anni", tipo:"numero", campo:"anni", unita:"anni",
  titolo:"Per quanti anni la terresti?",
  aiuto:"Il conto si fa sull'intero periodo: l'acquisto all'inizio, le spese ogni anno e quello che ti resta in mano quando la rivendi."}
];

function attivi(){return PASSI.filter(function(p){return !(p.saltaSe&&p.saltaSe())})}
var idx=0;

/* ==================== DISEGNO DELLE DOMANDE ==================== */
function campoNumero(id,val,unita,passo){
  return '<div class="numerico"><input type="number" id="'+id+'" min="0" step="'+(passo||1)+'" value="'+val+'" inputmode="decimal" aria-label="'+esc(unita)+'">'+
         '<div class="unita"><span class="etichetta">'+unita+'</span></div></div>';
}

function disegnaPasso(){
  var lista=attivi(); if(idx>=lista.length){ disegnaEsito(); return; }
  var p=lista[idx];
  document.getElementById("wrap").className="wrap";
  document.getElementById("contatore").textContent="Domanda "+(idx+1)+" di "+lista.length;
  document.getElementById("barra").style.width=(idx/lista.length*100)+"%";
  var top=document.getElementById("indietro-top"); if(top) top.hidden=idx===0;

  var h='<div class="domanda"><h1>'+p.titolo+'</h1><p class="aiuto">'+p.aiuto+'</p>';
  if(p.tipo==="consumo"){
    var kml=S.unitaT==="kml", v=kml ? Math.round(100/S.consT*10)/10 : S.consT;
    h+='<div class="numerico"><input type="number" id="in-num" min="0" step="0.1" value="'+v+'" inputmode="decimal" aria-label="consumo">'+
       '<div class="unita" role="group" aria-label="unità"><button type="button" id="u-l100" aria-pressed="'+(!kml)+'">L/100 km</button>'+
       '<button type="button" id="u-kml" aria-pressed="'+kml+'">km/L</button></div></div><p class="nota" id="conv"></p>';
  }else if(p.tipo==="numero"){
    h+=campoNumero("in-num",S[p.campo],p.unita,p.passo)+'<p class="nota" id="conv"></p>';
    if(p.id==="km") h+='<div class="carica"><label for="in-file">Oppure ricavali dalla <strong>Cronologia di Google</strong>: carica i file JSON di Takeout o l\'export Spostamenti dal telefono. Conto solo i tragitti in auto e li riporto a un anno. Il file non lascia il tuo dispositivo.</label>'+
                       '<input type="file" id="in-file" accept=".json,application/json" multiple><p class="nota" id="esito-file"></p></div>';
  }else{
    h+='<div class="scelte">';
    p.opzioni.forEach(function(o){
      h+='<button type="button" class="scelta" data-v="'+o.v+'" aria-pressed="'+(S[p.campo]===o.v)+'">'+
         '<span class="segno"></span><span class="testo"><span>'+o.t+'</span>'+
         (o.s?'<span class="sub">'+o.s+'</span>':'')+'</span></button>';
    });
    h+='</div>';
  }
  h+='<div class="navi">';
  if(idx>0) h+='<button type="button" class="btn piatto" id="indietro">Indietro</button>';
  if(p.tipo!=="singola") h+='<button type="button" class="btn primario" id="avanti">Avanti</button>';
  h+='</div></div>';
  document.getElementById("palco").innerHTML=h;

  var avanti=function(){ idx++; disegnaPasso(); };
  if(p.tipo==="singola"){
    Array.prototype.forEach.call(document.querySelectorAll(".scelta"),function(b){
      b.addEventListener("click",function(){
        var v=b.getAttribute("data-v"); S[p.campo]=v;
        if(p.id==="iscritto"&&v==="no") window.open(CANALE,"_blank","noopener");
        if(p.id==="ricarica"){ S.quotaCasa=null; S.quotaDC=null; }
        avanti();
      });
    });
  }else{
    var inp=document.getElementById("in-num"), conv=document.getElementById("conv");
    var aggiorna=function(){
      var x=parseFloat(String(inp.value).replace(",","."));
      if(p.tipo==="consumo"){
        if(x>0) S.consT = S.unitaT==="kml" ? 100/x : x;
        conv.textContent = S.unitaT==="kml" ? "Sono "+num(S.consT,1)+" litri ogni 100 km." : "Sono "+num(100/S.consT,1)+" km con un litro.";
      }else{
        if(!isNaN(x)&&x>=0) S[p.campo]=x;
        if(p.id==="consE") conv.textContent = S.consE>0 ? "Sono "+num(100/S.consE,1)+" km con un kWh." : "";
        if(p.id==="km") conv.textContent = "Sono "+num(S.km/365)+" km al giorno, in media.";
        if(p.id==="anni") conv.textContent = S.anni>15 ? "Oltre i 15 anni le stime di rivendita non reggono più: il conto resta indicativo." : "";
      }
    };
    inp.addEventListener("input",aggiorna); aggiorna(); inp.focus(); inp.select();
    inp.addEventListener("keydown",function(e){ if(e.key==="Enter") avanti(); });
    document.getElementById("avanti").addEventListener("click",avanti);
    if(p.tipo==="consumo"){
      document.getElementById("u-l100").addEventListener("click",function(){ if(S.unitaT!=="l100"){S.unitaT="l100"; disegnaPasso();} });
      document.getElementById("u-kml").addEventListener("click",function(){ if(S.unitaT!=="kml"){S.unitaT="kml"; disegnaPasso();} });
    }
    var f=document.getElementById("in-file");
    if(f) f.addEventListener("change",function(){ leggiTakeout(f.files,inp); });
  }
  var ind=document.getElementById("indietro");
  if(ind) ind.addEventListener("click",function(){ idx--; disegnaPasso(); });
  window.scrollTo(0,0);
}

function leggiTakeout(files,inp){
  var out=document.getElementById("esito-file"), letti=0, tot=0, da=null, a=null, errori=0;
  if(!files||!files.length) return;
  out.textContent="Leggo "+files.length+(files.length>1?" file…":" file…");
  Array.prototype.forEach.call(files,function(file){
    var r=new FileReader();
    r.onload=function(){
      try{
        var x=kmDaTakeout(JSON.parse(r.result));
        tot+=x.km;
        if(x.da!==null){ da = da===null ? x.da : Math.min(da,x.da); a = a===null ? x.a : Math.max(a,x.a); }
      }catch(e){ errori++; }
      fine();
    };
    r.onerror=function(){ errori++; fine(); };
    r.readAsText(file);
  });
  function fine(){
    if(++letti<files.length) return;
    if(da===null||tot<=0){ out.textContent="Nei file non ho trovato tragitti in auto con le date: il numero lo devi scrivere a mano."+(errori?" ("+errori+" file non leggibili)":""); return; }
    var giorni=Math.max(1,(a-da)/86400000), stima=Math.round(tot*365/giorni);
    S.km=stima; S.kmDaFile={km:tot,giorni:giorni}; inp.value=stima;
    out.innerHTML="Ho trovato <strong>"+num(tot)+" km in auto</strong> in "+num(giorni)+" giorni: sono circa <strong>"+num(stima)+" km l'anno</strong>. Li ho messi nel campo qui sopra."+
                  (giorni<90?" Il periodo è corto: la stima vale poco, se puoi carica più mesi.":"");
    document.getElementById("conv").textContent="Sono "+num(S.km/365)+" km al giorno, in media.";
  }
}

/* ==================== ESITO ==================== */
var ULTIMO=null, ricalcoloInCoda=null;
function ricalcola(){
  /* accorpa la raffica di eventi di una freccina tenuta premuta: un solo ridisegno.
     setTimeout e non requestAnimationFrame, che a scheda nascosta non scatta mai. */
  if(ricalcoloInCoda) return;
  ricalcoloInCoda=setTimeout(function(){ ricalcoloInCoda=null; disegnaEsito(true); },50);
}

function etichette(){
  var t={benzina:"a benzina",gasolio:"a gasolio",ibrida:"full hybrid a benzina"};
  var p={citta:"soprattutto città",misto:"un po' di tutto",auto:"soprattutto autostrada"};
  var r={casa:"quasi sempre a casa",misto:"un po' a casa, un po' fuori",fuori:"solo colonnine pubbliche"};
  return {tipoT:t[S.tipoT||"benzina"],percorso:p[S.percorso||"misto"],ricarica:r[S.ricarica||"casa"]};
}

function r3(lab,a,b,cls){ return '<tr'+(cls?' class="'+cls+'"':'')+'><td>'+lab+'</td><td class="val">'+a+'</td><td class="val">'+b+'</td></tr>'; }

function grafico(r){
  var n=r.n, W=640, H=260, ml=62, mr=16, mt=16, mb=34;
  var tutti=r.T.cum.concat(r.E.cum,[r.T.tco,r.E.tco]);
  var max=Math.max.apply(null,tutti), min=Math.min(0,Math.min.apply(null,tutti));
  var passo=Math.pow(10,Math.floor(Math.log(max)/Math.LN10)); if(max/passo<4) passo/=2; if(max/passo>8) passo*=2;
  var top=Math.ceil(max/passo)*passo;
  var X=function(a){return ml+(W-ml-mr)*a/n}, Y=function(v){return mt+(H-mt-mb)*(1-(v-min)/(top-min))};
  var s='<svg viewBox="0 0 '+W+' '+H+'" class="grafico" role="img" aria-label="Spesa cumulata anno per anno">';
  for(var v=0;v<=top+1;v+=passo) s+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" class="g-griglia"/><text x="'+(ml-8)+'" y="'+(Y(v)+4)+'" class="g-asse" text-anchor="end">'+num(v/1000)+'k</text>';
  var ogni=n>10?2:1;
  for(var a=0;a<=n;a+=ogni) s+='<text x="'+X(a)+'" y="'+(H-12)+'" class="g-asse" text-anchor="middle">'+a+'</text>';
  [[r.T,"g-t"],[r.E,"g-e"]].forEach(function(c){
    var d=c[0].cum.map(function(v,i){return (i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)}).join(" ");
    s+='<path d="'+d+'" class="'+c[1]+'"/>';
    s+='<path d="M'+X(n)+' '+Y(c[0].cum[n])+' L'+X(n)+' '+Y(c[0].tco)+'" class="'+c[1]+' g-tratto"/>';
    s+='<circle cx="'+X(n)+'" cy="'+Y(c[0].tco)+'" r="5" class="'+c[1]+'-punto"><title>'+c[0].nome+' dopo la rivendita: '+eur(c[0].tco)+'</title></circle>';
  });
  if(r.pareggio && r.pareggio.anni<=n){
    var xp=X(r.pareggio.anni), yp=Y(r.pareggio.chi.cum[Math.floor(r.pareggio.anni)]+(r.pareggio.chi.cum[Math.min(n,Math.ceil(r.pareggio.anni))]-r.pareggio.chi.cum[Math.floor(r.pareggio.anni)])*(r.pareggio.anni%1));
    s+='<circle cx="'+xp+'" cy="'+yp+'" r="6" class="g-pareggio"/>';
  }
  s+='</svg><div class="legenda"><span><i class="l-t"></i>Termica</span><span><i class="l-e"></i>Elettrica</span><span class="nota">anni sull\'asse orizzontale · il pallino finale è il costo dopo la rivendita</span></div>';
  return s;
}

function disegnaEsito(soloRicalcolo){
  var r=calcola(), T=r.T, E=r.E, n=r.n, L=etichette(), sk=sogliaKm();
  ULTIMO=r;
  document.getElementById("wrap").className="wrap largo";
  document.getElementById("contatore").textContent="Riepilogo";
  document.getElementById("barra").style.width="100%";
  var top=document.getElementById("indietro-top"); if(top) top.hidden=true;

  var diff=Math.abs(T.tco-E.tco), vince=E.tco<T.tco?E:T, perde=vince===E?T:E;
  var pari = diff < 0.02*Math.max(T.tco,E.tco);
  var titolo = pari ? "Praticamente pari" :
               (vince===E ? "L'elettrica ti fa risparmiare "+eur(diff) : "La termica costa "+eur(diff)+" in meno");
  var spiega;
  if(pari) spiega="In "+n+" anni la differenza è di "+eur(diff)+": sotto il 2% del totale, cioè dentro l'incertezza delle stime. Qui decidono le cose che il conto non vede: dove la parcheggi, che viaggi fai, quanto ti pesa la sosta alla colonnina.";
  else if(r.pareggio && r.pareggio.anni<=n) spiega="In "+n+" anni, tutto compreso. "+(r.pareggio.chi===E?"L'elettrica":"La termica")+" costa "+eur(Math.abs(E.esborso-T.esborso))+" in più all'acquisto, ma la differenza la recuperi in <strong>"+num(r.pareggio.anni,1)+" anni</strong>.";
  else if((vince===E&&E.esborso<=T.esborso)||(vince===T&&T.esborso<=E.esborso)) spiega="In "+n+" anni, tutto compreso. Costa meno sia all'acquisto sia nell'uso: non c'è un pareggio da aspettare.";
  else spiega="In "+n+" anni, tutto compreso. "+(perde===E?"L'elettrica":"La termica")+" costa meno nell'uso, ma non abbastanza da recuperare quello che costa in più all'acquisto"+(r.pareggio?": ci vorrebbero "+num(r.pareggio.anni,1)+" anni.":" nel periodo.");

  var h='<div class="taglia-box"><p class="occhiello">Il conto su '+n+' anni</p>'+
        '<div class="taglia">'+titolo+'</div><p class="spiega">'+spiega+'</p></div>';

  /* --- tabella --- */
  h+='<div class="carta"><p class="occhiello">Il riepilogo</p><h2>Ecco il conto, riga per riga</h2>'+
     '<p class="nota">'+num(r.km)+' km l\'anno · '+L.percorso+' · ricarica '+L.ricarica+'</p><div class="scroll"><table class="tre">'+
     '<tr><th></th><th>Termica</th><th>Elettrica</th></tr>'+
     '<tr class="sez"><td colspan="3">Quello che mi hai detto</td></tr>'+
     r3("Alimentazione",L.tipoT,"elettrica")+
     r3("Consumo WLTP",num(S.consT,1)+" L/100 km",num(S.consE,1)+" kWh/100 km")+
     r3("Consumo stimato su strada",num(T.consumo,1)+" L/100 km",num(E.consumo,1)+" kWh/100 km")+
     r3("Prezzo medio dell'energia",num(T.prezzoUnita,3)+" €/L",num(E.prezzoUnita,3)+" €/kWh")+

     '<tr class="sez"><td colspan="3">Ogni anno</td></tr>'+
     r3("Carburante o ricarica",eur(T.energia),eur(E.energia))+
     r3("Manutenzione e gomme",eur(T.man),eur(E.man))+
     r3("Assicurazione",eur(T.ass),eur(E.ass))+
     r3("Bollo",eur(T.bolloAnno),E.bolloAnno>0&&n>BOLLO_ESENZIONE_EL?"0 € per 5 anni, poi "+eur(E.bolloAnno):"0 €")+
     r3("Per fare 100 km",num(T.per100,2)+" €",num(E.per100,2)+" €")+

     '<tr class="sez"><td colspan="3">In '+n+' anni</td></tr>'+
     r3("Acquisto",eur(S.prezzoT),eur(S.prezzoE))+
     (S.incentivo>0?r3("Incentivi","—","−"+eur(S.incentivo)):"")+
     r3("Spese di "+n+" anni",eur(T.spese),eur(E.spese))+
     r3("Quanto ne ricavi rivendendola","−"+eur(T.residuo),"−"+eur(E.residuo))+
     r3("Costo totale",eur(T.tco),eur(E.tco),"forte")+
     r3("Al chilometro",num(T.alKm,2)+" €",num(E.alKm,2)+" €")+
     '</table></div>'+
     '<p class="nota" style="margin-top:1rem">Il costo totale è quello che esce dalle tue tasche meno quello che rientra alla rivendita. Il valore di rivendita è la voce più incerta del conto: la trovi fra le carte scoperte, qui sotto.</p></div>';

  /* --- spesa anno per anno --- */
  h+='<div class="carta"><p class="occhiello">Anno per anno</p><h2>Quanto hai speso, a ogni compleanno dell\'auto</h2>'+grafico(r)+'</div>';

  /* --- il numero che decide --- */
  if(sk){
    var tuoi = r.km>=sk.km ? "sopra" : "sotto";
    var vSopra=sk.sopraVince, vSotto= vSopra==="Elettrica"?"Termica":"Elettrica";
    h+='<div class="carta rilievo'+(Math.abs(r.km-sk.km)/sk.km>0.3?" ok":"")+'"><p class="occhiello">Il numero che decide</p><h2>'+num(Math.round(sk.km/500)*500)+' km l\'anno</h2>'+
       '<p>Con queste due auto e questi prezzi, <strong>sopra i '+num(Math.round(sk.km/500)*500)+' km l\'anno conviene la '+vSopra.toLowerCase()+'</strong>, sotto la '+vSotto.toLowerCase()+'. Tu ne fai <span class="num">'+num(r.km)+'</span>: sei '+tuoi+', '+
       (Math.abs(r.km-sk.km)/sk.km>0.3?"con un buon margine.":"ma vicino al confine: basta un cambio di lavoro o di prezzi per ribaltare il risultato.")+'</p></div>';
  }

  /* --- dove ricarichi --- */
  var per100=function(p){return num(E.consumo*p,2)+" €"};
  h+='<div class="carta"><p class="occhiello">Il pezzo che sposta più di tutti</p><h2>Dove ricarichi cambia tutto</h2>'+
     '<p>Fare 100 km con l\'elettrica costa <strong>'+(S.pCasa>0?num(S.pDC/S.pCasa,1)+" volte tanto":"molto di più")+'</strong> alla colonnina veloce rispetto a casa. La termica, invece, costa più o meno uguale ovunque.</p><div class="scroll"><table>'+
     '<tr class="sez"><td colspan="2">Quanto costano 100 km</td></tr>'+
     '<tr><td>Con la termica</td><td class="val">'+num(T.per100,2)+' €</td></tr>'+
     '<tr><td>Elettrica, a casa con la luce di casa</td><td class="val">'+per100(S.pCasa)+'</td></tr>'+
     '<tr><td>Elettrica, alla colonnina in corrente alternata</td><td class="val">'+per100(S.pAC)+'</td></tr>'+
     '<tr><td>Elettrica, alla colonnina veloce</td><td class="val">'+per100(S.pDC)+'</td></tr>'+
     '<tr class="forte"><td>Elettrica, con il tuo mix di ricarica</td><td class="val">'+num(E.per100,2)+' €</td></tr>'+
     '</table></div>'+
     '<p class="nota" style="margin-top:1rem">Se a casa hai o metti il fotovoltaico e ricarichi di giorno, il kWh costa molto meno: il conto completo lo fa il <a href="'+FOTOVOLTAICO+'" target="_blank" rel="noopener">calcolatore fotovoltaico</a>.</p></div>';

  /* --- CO2 --- */
  var dCo2=T.co2-E.co2;
  h+='<div class="carta"><p class="occhiello">Sul clima</p><h2>'+(dCo2>0?num(dCo2/1000,1)+" tonnellate di CO₂ in meno l'anno":"Nessun vantaggio sulla CO₂")+'</h2>'+
     '<p>La termica emette <span class="num">'+num(T.co2/1000,1)+' t</span> l\'anno dallo scarico, l\'elettrica <span class="num">'+num(E.co2/1000,1)+' t</span> dalle centrali che producono la sua corrente. In '+n+' anni fanno <span class="num">'+num(Math.max(0,dCo2)*n/1000,1)+' t</span> di differenza.</p>'+
     '<p class="nota">Sola combustione, da entrambe le parti: non conta l\'estrazione del petrolio né quella del gas, e non conta la costruzione dell\'auto e della batteria.</p></div>';

  /* --- carte scoperte: disegnate una volta, non si ridisegnano mentre l'utente scrive --- */
  var q=r.q;
  var hIp='<div class="carta"><p class="occhiello">Le carte scoperte</p><h2>Con che numeri ho calcolato</h2>'+
     '<p class="nota">Sono tutti qui, con la fonte e la data. Se non sei d\'accordo con uno, cambialo: il risultato si rifà da solo. È il motivo per cui questo strumento esiste.</p>'+
     '<div class="griglia-ip">'+
     ipCampo("pBenz","Benzina (€/L)",S.pBenz,0.001,"Prezzo medio self service sulla rete stradale, Osservatorio prezzi MIMIT, 1° novembre 2026. Cambia ogni giorno.")+
     ipCampo("pGas","Gasolio (€/L)",S.pGas,0.001,"Stessa fonte e stessa data: MIMIT, 1° novembre 2026, self service.")+
     ipCampo("pCasa","Luce di casa (€/kWh)",S.pCasa,0.001,"ARERA, cliente tipo vulnerabile in maggior tutela, IV trimestre 2026, imposte incluse: +37,3% sul trimestre prima. Sul mercato libero si trova di meno: guarda la tua bolletta.")+
     ipCampo("pAC","Colonnina lenta (€/kWh)",S.pAC,0.01,"Listino Enel X Way, Pay Per Use senza abbonamento, corrente alternata, IVA inclusa. Con un abbonamento si scende a 0,45-0,50.")+
     ipCampo("pDC","Colonnina veloce (€/kWh)",S.pDC,0.01,"Listino Enel X Way, corrente continua fino a 150 kW. Oltre i 150 kW sono 0,99.")+
     ipCampo("quotaCasa","Ricariche fatte a casa (%)",Math.round(q.casa*100),5,"Non è un dato misurato: è l'ipotesi che discende dalla tua risposta — 90% se ricarichi quasi sempre a casa, 50% un po' e un po', 0% senza box. Cambiala se sai come fai.")+
     ipCampo("quotaDC","Ricariche fuori fatte in veloce (%)",Math.round(q.dcSuFuori*100),5,"Quota delle ricariche pubbliche alle colonnine veloci. Ipotesi: 30% per chi ricarica un po' fuori, 40% per chi non ha il box.")+
     ipCampo("scostT","Consumo reale della termica oltre il WLTP (%)",S.scostT,1,"Ipotesi: su strada si consuma di solito il 10-25% in più del dato omologato. Più la correzione per il tipo di strada che mi hai indicato.")+
     ipCampo("scostE","Consumo reale dell'elettrica oltre il WLTP (%)",S.scostE,1,"Ipotesi, come sopra. Il WLTP delle elettriche è misurato alla presa, quindi include già le perdite di ricarica. D'inverno si consuma il 15-30% in più.")+
     ipCampo("manT","Manutenzione termica (€/anno)",manTermica(),50,"Ipotesi: tagliandi, olio, filtri, freni, gomme. 600 € per benzina e gasolio, 500 per la full hybrid, che consuma meno i freni.")+
     ipCampo("manE","Manutenzione elettrica (€/anno)",S.manE,50,"Ipotesi: niente olio né frizione, freni che durano di più; le gomme si consumano un po' prima per il peso.")+
     ipCampo("assT","Assicurazione termica (€/anno)",S.assT,50,"Uguale per le due auto di partenza, così non sposta il risultato. Mettici i tuoi preventivi: fra le due la differenza può esserci.")+
     ipCampo("assE","Assicurazione elettrica (€/anno)",S.assE,50,"Come sopra.")+
     ipCampo("kwT","Potenza termica (kW)",S.kwT,1,"Serve per il bollo: 2,58 €/kW fino a 100 kW e 3,87 €/kW oltre, tariffa ordinaria Euro 4-6. La trovi sul libretto, alla voce P.2.")+
     ipCampo("kwE","Potenza elettrica (kW)",S.kwE,1,"Le elettriche non pagano il bollo per 5 anni, poi un quarto della tariffa. In alcune regioni, come Piemonte e Lombardia, va meglio: controlla la tua.")+
     ipCampo("svalT","Svalutazione termica (% l'anno)",S.svalT,1,"Ipotesi: perde il "+S.svalT+"% del valore ogni anno, quindi dopo "+n+" anni vale il "+num(100*Math.pow(1-S.svalT/100,n))+"% del prezzo.")+
     ipCampo("svalE","Svalutazione elettrica (% l'anno)",S.svalE,1,"Ipotesi più prudente: l'usato elettrico oggi si svaluta più in fretta, perché i modelli nuovi migliorano autonomia e prezzo. È la voce più incerta del conto.")+
     ipCampo("co2R","CO₂ della rete (kg/kWh)",S.co2R,0.001,"ISPRA, rapporto 430/2026: fattore dei consumi elettrici 2025, 199,6 g CO₂/kWh. Benzina 2,33 e gasolio 2,65 kg per litro, di sola combustione.")+
     '</div>'+
     '<div class="avviso"><strong>Il consumo su strada.</strong> Parto dal dato WLTP e lo correggo due volte: per il tipo di strada (in città la termica consuma il 15% in più del suo WLTP e l\'elettrica il 20% in meno; in autostrada l\'elettrica il 30% in più) e per lo scostamento reale qui sopra. Sono stime: se conosci il consumo vero della tua auto, rimetti quello come WLTP e porta lo scostamento a zero.</div></div>';

  var hSotto='<div class="carta"><p class="occhiello">Il passo successivo</p><h2>Portalo in concessionaria</h2>'+
     '<p>Il venditore ti dirà il prezzo e la rata. Il resto del conto di solito non lo fa nessuno. Qui sotto scarichi un foglio con <strong>il tuo confronto</strong>, le ipotesi che ho usato e <strong>sette domande da farti rispondere per iscritto</strong> prima di firmare.</p>'+
     '<div class="navi"><button type="button" class="btn primario" id="pdf">Stampa o salva in PDF</button>'+
     '<button type="button" class="btn piatto" id="txt">Scarica in formato testo</button></div>'+
     '<p class="nota" style="margin-top:.9rem">Il formato testo serve per incollarlo in una email o in un messaggio. Il PDF si ottiene dalla finestra di stampa scegliendo «Salva come PDF» invece della stampante.</p></div>';
  hSotto+='<div class="navi"><button type="button" class="btn piatto" id="rifai">Rifai il calcolo da capo</button>'+
     '<button type="button" class="btn piatto" id="modifica">Torna all\'ultima domanda</button></div>';
  hSotto+='<footer>'+
     '<p><strong>Cosa non c\'è in questi conti.</strong> L\'inflazione e il valore del denaro nel tempo: i prezzi restano quelli di oggi per tutto il periodo. Il costo della wallbox, che dipende dalla linea da tirare e va quotato a parte. Il finanziamento: se compri a rate, gli interessi vanno aggiunti all\'auto che finanzi.</p>'+
     '<p><strong>La batteria.</strong> Le garanzie tipiche sono di 8 anni o 160.000 km al 70% della capacità. Una sostituzione fuori garanzia non è conteggiata: è rara, ma è il rischio che rende incerto il valore di rivendita.</p>'+
     '<p><strong>Una stima, non un preventivo.</strong> Serve a capire l\'ordine di grandezza e a farti fare le domande giuste. Non vendo auto, non prendo provvigioni e in questa pagina non c\'è nessuno da contattare.</p>'+
     '</footer>';

  if(soloRicalcolo){ document.getElementById("esito-sopra").innerHTML=h; return; }
  document.getElementById("palco").innerHTML='<div id="esito-sopra">'+h+'</div>'+hIp+hSotto;

  ["pBenz","pGas","pCasa","pAC","pDC","scostT","scostE","manE","assT","assE","kwT","kwE","svalT","svalE","co2R"].forEach(function(c){
    document.getElementById("ip-"+c).addEventListener("input",function(e){
      var v=parseFloat(String(e.target.value).replace(",",".")); if(!isNaN(v)&&v>=0){ S[c]=v; ricalcola(); }
    });
  });
  document.getElementById("ip-manT").addEventListener("input",function(e){
    var v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0){ S.manT=v; ricalcola(); }
  });
  document.getElementById("ip-quotaCasa").addEventListener("input",function(e){
    var v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0&&v<=100){ S.quotaCasa=v/100; ricalcola(); }
  });
  document.getElementById("ip-quotaDC").addEventListener("input",function(e){
    var v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0&&v<=100){ S.quotaDC=v/100; ricalcola(); }
  });
  document.getElementById("pdf").addEventListener("click",function(){
    document.getElementById("stampa").innerHTML=costruisciReport(ULTIMO);
    /* il nome proposto dal browser al «salva come PDF» è il titolo del documento.
       Se la pagina è incorniciata (Streamlit) lo decide la cornice più esterna:
       le rinominiamo tutte per la durata della stampa. */
    var salvati=[], w=window;
    for(var i=0;i<6;i++){
      try{ salvati.push({d:w.document, t:w.document.title}); w.document.title=NOMEFILE; }catch(e){}
      if(w===w.top) break;
      w=w.parent;
    }
    window.print();
    setTimeout(function(){ salvati.forEach(function(s){ try{ s.d.title=s.t; }catch(e){} }); },2000);
  });
  document.getElementById("txt").addEventListener("click",function(){
    var blob=new Blob([reportTesto(ULTIMO)],{type:"text/plain;charset=utf-8"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=NOMEFILE+".txt";
    document.body.appendChild(a); a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},1000);
  });
  document.getElementById("rifai").addEventListener("click",function(){
    S.tipoT=null; S.percorso=null; S.ricarica=null; S.quotaCasa=null; S.quotaDC=null; S.manT=null; S.kmDaFile=null;
    idx=0; disegnaPasso();
  });
  document.getElementById("modifica").addEventListener("click",function(){ idx=attivi().length-1; disegnaPasso(); });
  window.scrollTo(0,0);
}

/* ==================== FOGLIO DA STAMPARE ==================== */
var DOMANDE_VENDITORE=[
  "Qual è il consumo reale che misurate sui vostri clienti, d'estate e d'inverno, e non solo il WLTP?",
  "Garanzia della batteria: quanti anni, quanti chilometri e a quale capacità residua minima? Chi misura la capacità, e come?",
  "Quanto costa il tagliando, e ogni quanti chilometri o mesi? Mettetelo per scritto per i primi cinque anni.",
  "A che potenza ricarica in corrente alternata (kW) e in continua? Con una presa di casa da 3 kW quante ore servono per il mio uso settimanale?",
  "Gli incentivi o gli sconti sono già nel prezzo? Se il bonus statale non arriva, chi paga la differenza?",
  "Se compro a rate: TAN, TAEG, maxi-rata finale e valore futuro garantito, scritti nero su bianco.",
  "Quanto mi valutate oggi l'usato, e quanto stimate valga quest'auto fra "+S.anni+" anni?"
];

function riga(k,a,b){return '<tr><td>'+k+'</td><td class="n">'+a+'</td><td class="n">'+b+'</td></tr>'}
function costruisciReport(r){
  var T=r.T,E=r.E,n=r.n,L=etichette(),q=r.q, oggi=new Date();
  var d=("0"+oggi.getDate()).slice(-2)+"/"+("0"+(oggi.getMonth()+1)).slice(-2)+"/"+oggi.getFullYear();
  var esito = Math.abs(T.tco-E.tco)<0.02*Math.max(T.tco,E.tco) ? "Le due auto costano praticamente uguale" :
              (E.tco<T.tco ? "L'elettrica costa "+eur(T.tco-E.tco)+" in meno" : "La termica costa "+eur(E.tco-T.tco)+" in meno");
  return '<h1>Elettrica o termica: il mio confronto</h1>'+
    '<p class="sotto">Calcolato il '+d+' · '+num(r.km)+' km l\'anno · '+n+' anni · '+L.percorso+' · ricarica '+L.ricarica+'</p>'+
    '<p><b>'+esito+' in '+n+' anni, tutto compreso.</b>'+(r.pareggio&&r.pareggio.anni<=n?' Pareggio dopo '+num(r.pareggio.anni,1)+' anni.':'')+'</p>'+
    '<h2>Il conto</h2><table><tr><th>Voce</th><th>Termica ('+L.tipoT+')</th><th>Elettrica</th></tr>'+
    riga("Prezzo d'acquisto",eur(S.prezzoT),eur(S.prezzoE))+
    (S.incentivo>0?riga("Incentivi","—","−"+eur(S.incentivo)):"")+
    riga("Consumo WLTP / stimato",num(S.consT,1)+" / "+num(T.consumo,1)+" L/100 km",num(S.consE,1)+" / "+num(E.consumo,1)+" kWh/100 km")+
    riga("Carburante o ricarica, all'anno",eur(T.energia),eur(E.energia))+
    riga("Manutenzione, all'anno",eur(T.man),eur(E.man))+
    riga("Assicurazione, all'anno",eur(T.ass),eur(E.ass))+
    riga("Bollo in "+n+" anni",eur(T.bollo),eur(E.bollo))+
    riga("Rivendita dopo "+n+" anni","−"+eur(T.residuo),"−"+eur(E.residuo))+
    riga("<b>Costo totale</b>","<b>"+eur(T.tco)+"</b>","<b>"+eur(E.tco)+"</b>")+
    riga("Al chilometro",num(T.alKm,2)+" €",num(E.alKm,2)+" €")+
    riga("CO₂ all'anno",num(T.co2/1000,1)+" t",num(E.co2/1000,1)+" t")+
    '</table>'+
    '<h2>Le ipotesi che ho usato</h2><ul>'+
    '<li>Benzina '+num(S.pBenz,3)+' €/L, gasolio '+num(S.pGas,3)+' €/L (MIMIT, 1/11/2026).</li>'+
    '<li>Ricarica: '+num(q.casa*100)+'% a casa a '+num(S.pCasa,3)+' €/kWh, '+num(q.ac*100)+'% in colonnina lenta a '+num(S.pAC,2)+', '+num(q.dc*100)+'% in veloce a '+num(S.pDC,2)+'.</li>'+
    '<li>Consumo su strada: +'+S.scostT+'% sul WLTP per la termica, +'+S.scostE+'% per l\'elettrica, più la correzione per il tipo di strada.</li>'+
    '<li>Svalutazione: '+S.svalT+'% l\'anno per la termica, '+S.svalE+'% per l\'elettrica.</li>'+
    '<li>Bollo a '+S.kwT+' kW per la termica; l\'elettrica ('+S.kwE+' kW) esente 5 anni, poi un quarto.</li>'+
    '</ul>'+
    '<h2>Sette domande da farsi rispondere per iscritto</h2>'+
    '<p class="guida">Le risposte vanno nella proposta d\'ordine o in una email: a voce non valgono.</p><ol>'+
    DOMANDE_VENDITORE.map(function(x){return '<li>'+x+'</li>'}).join("")+'</ol>'+
    '<p class="piede">Calcolatore gratuito «Elettrica o termica?» del canale YouTube Gianluca Gualco — Energia. Una stima, non un preventivo: i prezzi restano quelli di oggi per tutto il periodo e non sono conteggiati inflazione, finanziamento e wallbox.</p>';
}
function reportTesto(r){
  var d=document.createElement("div"); d.innerHTML=costruisciReport(r);
  d.querySelectorAll("ol").forEach(function(ol){
    Array.prototype.forEach.call(ol.children,function(li,i){ li.insertBefore(document.createTextNode((i+1)+". "),li.firstChild); });
  });
  d.querySelectorAll("ul").forEach(function(ul){
    Array.prototype.forEach.call(ul.children,function(li){ li.insertBefore(document.createTextNode("— "),li.firstChild); });
  });
  d.querySelectorAll("h1,h2").forEach(function(el){
    el.insertBefore(document.createTextNode("\n"),el.firstChild);
    el.appendChild(document.createTextNode("\n"+"-".repeat(Math.min(60,el.textContent.length))+"\n"));
  });
  d.querySelectorAll("p,li,tr").forEach(function(el){el.appendChild(document.createTextNode("\n"))});
  d.querySelectorAll("td,th").forEach(function(el){el.appendChild(document.createTextNode("\t"))});
  return d.textContent.replace(/\t\n/g,"\n").replace(/\n{3,}/g,"\n\n").replace(/[ \t]+$/gm,"").trim();
}

function ipCampo(id,lab,val,step,fonte){
  return '<div class="ip"><label for="ip-'+id+'">'+lab+'</label>'+
         '<input type="number" id="ip-'+id+'" value="'+val+'" step="'+step+'" min="0" inputmode="decimal" autocomplete="off">'+
         '<span class="fonte">'+fonte+'</span></div>';
}

/* per i test: espone il conto senza toccare la pagina */
window.__AUTO__={S:S,calcola:calcola,sogliaKm:sogliaKm,kmDaTakeout:kmDaTakeout,tariffaBollo:tariffaBollo};

var top=document.getElementById("indietro-top");
if(top) top.addEventListener("click",function(){ if(idx>0){ idx--; disegnaPasso(); } });
disegnaPasso();
})();
