import { haalbaarheid, lieverNiet, pasToe, botsingen, klok, duur, weekdag } from '/planner/index.js';
import { week as voorbeeldWeek, profiel as voorbeeldProfiel } from '/voorbeeld/week.js';
import { esc, kop, statusKlasse } from '/app.js';

kop('vandaag');

// Toestand in het geheugen. Bewust niet in localStorage: het prototype werkt met voorbeeldgegevens
// en moet bij herladen weer bij het uitgangspunt beginnen, anders is het niet te vergelijken.
const VANDAAG = '2026-10-13';
const dagen = structuredClone(voorbeeldWeek);
const profielen = Object.fromEntries(dagen.map(d => [d.datum, d.datum === VANDAAG
  ? { ...voorbeeldProfiel }
  : { ...voorbeeldProfiel, slaapGisteren: voorbeeldProfiel.slaapDoel, energie: 3 }]));
const genegeerd = new Set(), doorgeschoven = {};
let gekozen = VANDAAG;

const dag = () => dagen.find(d => d.datum === gekozen);
const el = id => document.getElementById(id);
const kort = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const lang = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

function rekenen() {
  const d = dag(), profiel = profielen[gekozen];
  const h = haalbaarheid(d.blokken, profiel);
  const l = lieverNiet(d.blokken, profiel, { dagen, datum: gekozen });
  l.suggesties = l.suggesties.filter(s => !genegeerd.has(s.blokId));
  return { d, profiel, h, l, bots: botsingen(d.blokken, profiel) };
}

function teken() {
  const { d, profiel, h, l, bots } = rekenen();
  el('titel').textContent = gekozen === VANDAAG ? 'Vandaag' : lang(gekozen);
  el('ondertitel').textContent = gekozen === VANDAAG ? lang(gekozen) : '';

  el('dagen').innerHTML = dagen.map(x => {
    const s = haalbaarheid(x.blokken, profielen[x.datum]);
    return `<button class="dag" type="button" data-datum="${x.datum}" aria-pressed="${x.datum === gekozen}"><small>${kort(x.datum)}</small><b class="num ${statusKlasse(s.oordeel)}">${s.score}</b></button>`;
  }).join('');

  const vlag = new Map();
  for (const s of l.suggesties) vlag.set(s.blokId, ['liever', 'Liever niet']);
  for (const b of bots) { vlag.set(b.a.id, ['botst', 'Botst']); vlag.set(b.b.id, ['botst', 'Botst']); }
  const lijst = d.blokken.slice().sort((a, b) => a.start - b.start);
  el('plan-info').textContent = `${lijst.length} blokken · ${duur(h.vrij)} vrij`;
  el('plan').innerHTML = `<ol class="plan">${lijst.map(b => {
    const v = vlag.get(b.id);
    return `<li class="blok ${b.soort === 'reis' ? 'reis' : ''} ${b.vast ? 'vast' : ''}"><time>${klok(b.start)}–${klok(b.einde)}</time>
      <div><b>${esc(b.titel)}</b><span class="soort">${esc(b.soort.replace('-', ' '))}</span><span class="duur">${duur(b.einde - b.start)}${b.vast ? ' · vast' : ''}</span>
      ${v ? `<span class="vlag vlag--${v[0]}">${v[1]}</span>` : ''}</div></li>`;
  }).join('')}</ol>${(doorgeschoven[gekozen] || []).length ? `<p class="doorgeschoven">Doorgeschoven naar deze dag: ${doorgeschoven[gekozen].map(esc).join(', ')}. Nog zonder tijd.</p>` : ''}`;

  el('score').innerHTML = `
    <div class="score"><div class="score-getal num ${statusKlasse(h.oordeel)}">${h.score}<small> / 100</small></div>
      <div class="oordeel ${statusKlasse(h.oordeel)}"><i></i>${h.oordeel === 'haalbaar' ? 'Haalbaar' : h.oordeel === 'krap' ? 'Krap' : 'Te vol'}</div></div>
    <div class="meter ${statusKlasse(h.oordeel)}" role="img" aria-label="Haalbaarheid ${h.score} van 100"><b style="width:${h.score}%"></b></div>
    ${h.aftrek.length ? `<ul class="aftrek">${h.aftrek.map(a => `<li><b>−${a.punten}</b><span>${esc(a.reden)}</span></li>`).join('')}</ul>` : '<p class="leeg">Niets dat punten kost.</p>'}
    <div class="regelaars">
      <div><label for="slaap">Slaap afgelopen nacht <span class="num">${duur(profiel.slaapGisteren)}</span></label>
        <input id="slaap" type="range" min="0" max="600" step="15" value="${profiel.slaapGisteren}"></div>
      <fieldset><legend>Energie vanochtend <span class="num">${profiel.energie} van 5</span></legend>
        <div class="energie">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="energie" value="${n}" ${n === profiel.energie ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
    </div>`;

  el('liever').innerHTML = l.suggesties.length || l.opmerkingen.length ? `
    ${l.suggesties.length ? `<p class="na">Als je alles volgt: <b class="num">${l.scoreNa}</b> in plaats van <b class="num">${h.score}</b>.</p>` : ''}
    ${l.suggesties.map(s => `<div class="suggestie"><h3><s>${esc(s.titel)}</s></h3><p>${esc(s.reden)}</p><p class="alt">${esc(s.alternatief)}</p>
      <div class="knoppen"><button class="knop knop--vol" type="button" data-actie="pas" data-blok="${esc(s.blokId)}">Doe dit</button><button class="knop" type="button" data-actie="laat" data-blok="${esc(s.blokId)}">Laat zo</button></div></div>`).join('')}
    ${l.opmerkingen.map(o => `<p class="opmerking">${esc(o)}</p>`).join('')}`
    : '<p class="leeg">Niets dat je beter kunt laten. Deze dag past.</p>';

  el('k-botsing').hidden = !bots.length;
  el('botsing').innerHTML = bots.map(b => `<div class="suggestie"><h3>${esc(b.a.titel)} en ${esc(b.b.titel)}</h3>
    <p>${klok(b.a.start)}–${klok(b.a.einde)} tegenover ${klok(b.b.start)}–${klok(b.b.einde)}.</p>
    ${b.voorstel ? `<p class="alt">${esc(b.voorstel.tekst)}</p><div class="knoppen"><button class="knop knop--vol" type="button" data-actie="schuif" data-blok="${esc(b.voorstel.blokId)}" data-start="${b.voorstel.start}" data-einde="${b.voorstel.einde}">Schuif</button></div>`
      : '<p class="alt">Beide staan vast. Kies zelf wat voorgaat.</p>'}</div>`).join('');
}

document.addEventListener('click', e => {
  const knop = e.target.closest('button');
  if (!knop) return;
  if (knop.dataset.datum) { gekozen = knop.dataset.datum; return teken(); }
  const d = dag(), id = knop.dataset.blok;
  if (knop.dataset.actie === 'laat') { genegeerd.add(id); return teken(); }
  if (knop.dataset.actie === 'schuif') {
    const blok = d.blokken.find(b => b.id === id);
    blok.start = Number(knop.dataset.start); blok.einde = Number(knop.dataset.einde);
    return teken();
  }
  if (knop.dataset.actie === 'pas') {
    const { l } = rekenen(), s = l.suggesties.find(x => x.blokId === id);
    if (!s) return;
    if (s.soort === 'verplaatsen') {
      const naar = dagen.find(x => x.datum > gekozen && weekdag(x.datum) && s.alternatief.includes(weekdag(x.datum)));
      if (naar) (doorgeschoven[naar.datum] ||= []).push(s.titel);
    }
    d.blokken = pasToe(d.blokken, [s]);
    teken();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'slaap') { profielen[gekozen].slaapGisteren = Number(e.target.value); teken(); el('slaap').focus(); }
  if (e.target.name === 'energie') { profielen[gekozen].energie = Number(e.target.value); teken(); document.querySelector('input[name=energie]:checked')?.focus(); }
});
teken();
