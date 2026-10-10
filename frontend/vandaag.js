import { haalbaarheid, lieverNiet, pasToe, botsingen, weekBalans, klok, duur, weekdag } from '/planner/index.js';
import { week as voorbeeldWeek, profiel as voorbeeldProfiel } from '/voorbeeld/week.js';

// Toestand in het geheugen. Bewust niet in localStorage: het prototype werkt met voorbeeldgegevens
// en moet bij herladen weer bij het uitgangspunt beginnen, anders is het niet te vergelijken.
const VANDAAG = '2026-10-13';
const dagen = structuredClone(voorbeeldWeek);
const profielen = Object.fromEntries(dagen.map(d => [d.datum, d.datum === VANDAAG
  ? { ...voorbeeldProfiel }
  : { ...voorbeeldProfiel, slaapGisteren: voorbeeldProfiel.slaapDoel, energie: 3 }]));
const genegeerd = new Set(), doorgeschoven = {};
let gekozen = VANDAAG;

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const status = o => `s-${o.replace(' ', '-')}`;
const dag = () => dagen.find(d => d.datum === gekozen);
const datumTekst = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const kort = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const hoofdletter = s => s[0].toUpperCase() + s.slice(1);
const label = { haalbaar: 'Haalbaar', krap: 'Krap', 'te vol': 'Te vol' };

function rekenen() {
  const d = dag(), profiel = profielen[gekozen];
  const l = lieverNiet(d.blokken, profiel, { dagen, datum: gekozen });
  l.suggesties = l.suggesties.filter(s => !genegeerd.has(s.blokId));
  return { d, profiel, h: haalbaarheid(d.blokken, profiel), l, bots: botsingen(d.blokken, profiel) };
}

// Sliders en tabs worden niet opnieuw opgebouwd als ze het focuspunt hebben, anders valt het
// slepen weg na de eerste pixel.
function teken() {
  const { d, profiel, h, l, bots } = rekenen();
  el('intro-datum').textContent = hoofdletter(datumTekst(gekozen));
  el('intro-tekst').textContent = `Je dag is ${label[h.oordeel].toLowerCase()}: ${h.score} van 100. ${l.suggesties.length ? `LIFE ziet ${l.suggesties.length === 1 ? 'één ding' : `${l.suggesties.length} dingen`} die je beter kunt laten.` : 'Er is niets dat je beter kunt laten.'}`;

  el('dagtabs').innerHTML = dagen.map(x => {
    const s = haalbaarheid(x.blokken, profielen[x.datum]);
    return `<button class="dagtab" type="button" data-datum="${x.datum}" aria-pressed="${x.datum === gekozen}"><small>${kort(x.datum)}</small><b class="${status(s.oordeel)}">${s.score}</b></button>`;
  }).join('');

  el('score').innerHTML = `
    <div class="scorekop"><div class="scoregetal ${status(h.oordeel)}">${h.score}<small> / 100</small></div>
      <div class="oordeel ${status(h.oordeel)}"><i></i>${label[h.oordeel]}</div></div>
    <div class="maat ${status(h.oordeel)}" role="img" aria-label="Haalbaarheid ${h.score} van 100"><b style="width:${h.score}%"></b></div>
    ${h.aftrek.length ? `<ul class="aftrek">${h.aftrek.map(a => `<li><b>−${a.punten}</b><span>${esc(a.reden)}</span></li>`).join('')}</ul>` : '<p class="app-noot">Niets dat punten kost.</p>'}`;

  if (!el('slaap')) {
    el('regelaars').innerHTML = `<div class="regelaars">
      <div><label for="slaap">Slaap afgelopen nacht <span id="slaap-tekst"></span></label><input id="slaap" type="range" min="0" max="600" step="15"></div>
      <fieldset><legend>Energie vanochtend <span id="energie-tekst"></span></legend><div class="energie">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="energie" value="${n}"><span>${n}</span></label>`).join('')}</div></fieldset></div>
      <p class="app-noot">Verschuif de slaap en kijk wat er met je dag gebeurt.</p>`;
  }
  el('slaap').value = profiel.slaapGisteren;
  el('slaap-tekst').textContent = duur(profiel.slaapGisteren);
  el('energie-tekst').textContent = `${profiel.energie} van 5`;
  for (const r of document.querySelectorAll('input[name=energie]')) r.checked = Number(r.value) === profiel.energie;

  const vlag = new Map();
  for (const s of l.suggesties) vlag.set(s.blokId, ['liever', 'Liever niet']);
  for (const b of bots) { vlag.set(b.a.id, ['botst', 'Botst']); vlag.set(b.b.id, ['botst', 'Botst']); }
  const lijst = d.blokken.slice().sort((a, b) => a.start - b.start);
  el('plan-titel').textContent = hoofdletter(datumTekst(gekozen));
  el('plan-info').textContent = `${lijst.length} blokken · ${duur(h.vrij)} vrij`;
  el('plan').innerHTML = `<ol class="plan">${lijst.map(b => {
    const v = vlag.get(b.id);
    return `<li class="${b.soort === 'reis' ? 'reis' : ''} ${b.vast ? 'vast' : ''}"><time>${klok(b.start)}</time>
      <div><span>${esc(b.titel)}</span><small>${duur(b.einde - b.start)}${b.vast ? ' · vast' : ''}</small>${v ? `<span class="vlag vlag--${v[0]}">${v[1]}</span>` : ''}</div><em>${esc(b.soort.replace('-', ' '))}</em></li>`;
  }).join('')}</ol>${(doorgeschoven[gekozen] || []).length ? `<p class="doorgeschoven">Doorgeschoven naar deze dag: ${doorgeschoven[gekozen].map(esc).join(', ')}. Nog zonder tijd.</p>` : ''}`;

  el('liever-lijst').innerHTML = l.suggesties.length || l.opmerkingen.length ? `
    ${l.suggesties.length ? `<p class="na">Als je alles volgt: <b>${l.scoreNa}</b> in plaats van <b>${h.score}</b>.</p>` : ''}
    ${l.suggesties.map(s => `<div class="suggestie"><h4><s>${esc(s.titel)}</s></h4><p>${esc(s.reden)}</p><p class="alt">${esc(s.alternatief)}</p>
      <div class="knoppen"><button class="knopje knopje--vol" type="button" data-actie="pas" data-blok="${esc(s.blokId)}">Doe dit</button><button class="knopje" type="button" data-actie="laat" data-blok="${esc(s.blokId)}">Laat zo</button></div></div>`).join('')}
    ${l.opmerkingen.map(o => `<p class="opmerking">${esc(o)}</p>`).join('')}`
    : '<p class="app-noot">Niets dat je beter kunt laten. Deze dag past.</p>';

  el('botsingen').innerHTML = bots.length ? bots.map(b => `<div class="suggestie"><h4>${esc(b.a.titel)} en ${esc(b.b.titel)}</h4>
    <p>${klok(b.a.start)}–${klok(b.a.einde)} tegenover ${klok(b.b.start)}–${klok(b.b.einde)}.</p>
    ${b.voorstel ? `<p class="alt">${esc(b.voorstel.tekst)}</p><div class="knoppen"><button class="knopje knopje--vol" type="button" data-actie="schuif" data-blok="${esc(b.voorstel.blokId)}" data-start="${b.voorstel.start}" data-einde="${b.voorstel.einde}">Schuif</button></div>`
      : '<p class="alt">Beide staan vast. Kies zelf wat voorgaat.</p>'}</div>`).join('')
    : '<p class="app-noot">Geen botsingen op deze dag. Probeer vrijdag.</p>';

  const morgen = dagen[dagen.findIndex(x => x.datum === gekozen) + 1];
  if (morgen) {
    const m = haalbaarheid(morgen.blokken, profielen[morgen.datum]);
    el('afsluiting').innerHTML = `<dl class="feiten"><div><dt>Morgen</dt><dd>${weekdag(morgen.datum)}</dd></div><div><dt>Haalbaarheid</dt><dd class="${status(m.oordeel)}">${m.score} van 100</dd></div><div><dt>Naar bed</dt><dd>22:30</dd></div></dl>
      <p class="app-noot">${m.oordeel === 'haalbaar' ? 'Morgen past. Slaap lekker.' : 'Morgen is een drukke dag. Met een uur extra slaap houd je hem haalbaar.'}</p>`;
  } else el('afsluiting').innerHTML = '<p class="app-noot">Dit was de laatste dag van de week.</p>';
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
    const s = rekenen().l.suggesties.find(x => x.blokId === id);
    if (!s) return;
    if (s.soort === 'verplaatsen') {
      const naar = dagen.find(x => x.datum > gekozen && s.alternatief.includes(weekdag(x.datum)));
      if (naar) (doorgeschoven[naar.datum] ||= []).push(s.titel);
    }
    d.blokken = pasToe(d.blokken, [s]);
    teken();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'slaap') { profielen[gekozen].slaapGisteren = Number(e.target.value); teken(); }
  if (e.target.name === 'energie') { profielen[gekozen].energie = Number(e.target.value); teken(); }
});
teken();
