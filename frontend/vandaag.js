import { haalbaarheid, lieverNiet, pasToe, botsingen, klok, duur, weekdag } from '/planner/index.js';
import { api, esc, foutTekst, hoofdletter, koppelUitloggen, maandagVan, status, vandaag, weekVan } from '/api.js';

koppelUitloggen();

const el = id => document.getElementById(id);
const VANDAAG = vandaag();
const dagenIso = weekVan(VANDAAG);
const label = { haalbaar: 'Haalbaar', krap: 'Krap', 'te vol': 'Te vol' };
const datumTekst = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const kort = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

// Toestand. Alles wat de gebruiker invult staat op de server; hier staat alleen de weergave
// ervan, plus wat nog niet bewaard kan worden (slaap en energie zonder toestemming).
let profiel, blokken = [], checkins = {}, toestemming = false;
const lokaal = {}, genegeerd = new Set();
let gekozen = new URLSearchParams(location.search).get('dag');
if (!dagenIso.includes(gekozen)) gekozen = VANDAAG;

const blokkenVan = d => blokken.filter(b => b.datum === d);
const dagen = () => dagenIso.map(d => ({ datum: d, blokken: blokkenVan(d) }));
// Zonder check-in kennen we de slaap niet. We rekenen dan met het slaapdoel, en zeggen dat erbij.
const profielVoor = d => {
  const c = checkins[d], l = lokaal[d];
  return { wakkerVan: profiel.wakkerVan, wakkerTot: profiel.wakkerTot, slaapDoel: profiel.slaapDoel,
    slaapGisteren: l?.slaap ?? c?.slaapMinuten ?? profiel.slaapDoel, energie: l?.energie ?? c?.energie ?? 3 };
};
const heeftCheckin = d => Boolean(lokaal[d] || checkins[d]);

async function laad() {
  const van = dagenIso[0], tot = dagenIso[6];
  const [p, b, c, ik] = await Promise.all([
    api('GET', '/api/profiel'), api('GET', `/api/blokken?van=${van}&tot=${tot}`),
    api('GET', `/api/checkins?van=${van}&tot=${tot}`), api('GET', '/api/auth/ik'),
  ]);
  profiel = p; blokken = b; toestemming = ik.toestemmingGezondheid;
  checkins = Object.fromEntries(c.map(x => [x.datum, x]));
}

function rekenen() {
  const bl = blokkenVan(gekozen), pr = profielVoor(gekozen);
  const l = lieverNiet(bl, pr, { dagen: dagen(), datum: gekozen });
  l.suggesties = l.suggesties.filter(s => !genegeerd.has(s.blokId));
  return { bl, pr, h: haalbaarheid(bl, pr), l, bots: botsingen(bl, pr) };
}

function teken() {
  const { bl, pr, h, l, bots } = rekenen();
  el('leeg').hidden = blokken.length > 0;
  el('intro-datum').textContent = hoofdletter(datumTekst(gekozen));
  el('intro-tekst').textContent = blokken.length
    ? `Je dag is ${label[h.oordeel].toLowerCase()}: ${h.score} van 100. ${l.suggesties.length ? `LIFE ziet ${l.suggesties.length === 1 ? 'één ding' : `${l.suggesties.length} dingen`} die je beter kunt laten.` : 'Er is niets dat je beter kunt laten.'}`
    : 'Je agenda is nog leeg. Vul hem in, en LIFE maakt er een haalbaar dagplan van.';

  el('dagtabs').innerHTML = dagenIso.map(d => {
    const s = haalbaarheid(blokkenVan(d), profielVoor(d));
    return `<button class="dagtab" type="button" data-datum="${d}" aria-pressed="${d === gekozen}"><small>${kort(d)}</small><b class="${status(s.oordeel)}">${blokkenVan(d).length ? s.score : '–'}</b></button>`;
  }).join('');

  el('score').innerHTML = `
    <div class="scorekop"><div class="scoregetal ${status(h.oordeel)}">${h.score}<small> / 100</small></div>
      <div class="oordeel ${status(h.oordeel)}"><i></i>${label[h.oordeel]}</div></div>
    <div class="maat ${status(h.oordeel)}" role="img" aria-label="Haalbaarheid ${h.score} van 100"><b style="width:${h.score}%"></b></div>
    ${h.aftrek.length ? `<ul class="aftrek">${h.aftrek.map(a => `<li><b>−${a.punten}</b><span>${esc(a.reden)}</span></li>`).join('')}</ul>` : '<p class="app-noot">Niets dat punten kost.</p>'}
    ${heeftCheckin(gekozen) ? '' : '<p class="app-noot">Je hebt voor deze dag nog geen slaap en energie ingevuld. LIFE rekent met je slaapdoel.</p>'}`;

  if (!el('slaap')) {
    el('regelaars').innerHTML = `<div class="regelaars">
      <div><label for="slaap">Slaap afgelopen nacht <span id="slaap-tekst"></span></label><input id="slaap" type="range" min="0" max="600" step="15"></div>
      <fieldset><legend>Energie vanochtend <span id="energie-tekst"></span></legend><div class="energie">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="energie" value="${n}"><span>${n}</span></label>`).join('')}</div></fieldset></div>
      <p class="app-noot" id="regelaar-noot"></p>`;
  }
  el('slaap').value = pr.slaapGisteren;
  el('slaap-tekst').textContent = duur(pr.slaapGisteren);
  el('energie-tekst').textContent = `${pr.energie} van 5`;
  for (const r of document.querySelectorAll('input[name=energie]')) r.checked = Number(r.value) === pr.energie;
  el('regelaar-noot').innerHTML = toestemming
    ? 'Wat je hier invult, wordt bewaard.'
    : 'Je ziet direct wat het doet, maar het wordt niet bewaard. <a href="/invullen.html#gegevens">Geef toestemming</a> om slaap en energie te bewaren.';

  const vlag = new Map();
  for (const s of l.suggesties) vlag.set(s.blokId, ['liever', 'Liever niet']);
  for (const b of bots) { vlag.set(b.a.id, ['botst', 'Botst']); vlag.set(b.b.id, ['botst', 'Botst']); }
  const lijst = bl.slice().sort((a, b) => a.start - b.start);
  el('plan-titel').textContent = hoofdletter(datumTekst(gekozen));
  el('plan-info').textContent = lijst.length ? `${lijst.length} blokken · ${duur(h.vrij)} vrij` : 'Nog niets ingepland';
  el('plan').innerHTML = lijst.length ? `<ol class="plan">${lijst.map(b => {
    const v = vlag.get(b.id), klaar = b.status === 'gedaan';
    return `<li class="${b.soort === 'reis' ? 'reis' : ''} ${b.vast ? 'vast' : ''} ${klaar ? 'klaar' : ''}"><time>${klok(b.start)}</time>
      <div><span class="titel">${b.soort === 'reis' ? '' : `<button class="vink" type="button" data-actie="gedaan" data-blok="${esc(b.id)}" aria-pressed="${klaar}" aria-label="${esc(b.titel)} afvinken"></button>`}${esc(b.titel)}</span><small>${duur(b.einde - b.start)}${b.vast ? ' · vast' : ''}</small>${v ? `<span class="vlag vlag--${v[0]}">${v[1]}</span>` : ''}</div><em>${esc(b.soort.replace('-', ' '))}</em></li>`;
  }).join('')}</ol>` : '<p class="app-noot">Op deze dag staat nog niets. <a href="/invullen.html#agenda">Voeg een blok toe.</a></p>';

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
    : '<p class="app-noot">Geen botsingen op deze dag.</p>';

  const telbaar = bl.filter(b => b.soort !== 'reis'), klaarAantal = telbaar.filter(b => b.status === 'gedaan').length;
  const morgen = dagenIso[dagenIso.indexOf(gekozen) + 1];
  const kop = `<dl class="feiten"><div><dt>Vandaag gedaan</dt><dd>${klaarAantal} van ${telbaar.length}</dd></div></dl>`;
  if (morgen) {
    const m = haalbaarheid(blokkenVan(morgen), profielVoor(morgen));
    el('afsluiting').innerHTML = `${kop}<dl class="feiten"><div><dt>Morgen</dt><dd>${weekdag(morgen)}</dd></div><div><dt>Haalbaarheid</dt><dd class="${status(m.oordeel)}">${blokkenVan(morgen).length ? `${m.score} van 100` : '–'}</dd></div></dl>
      <p class="app-noot">${!blokkenVan(morgen).length ? 'Morgen staat nog niets in je agenda.' : m.oordeel === 'haalbaar' ? 'Morgen past. Slaap lekker.' : 'Morgen is een drukke dag. Met een uur extra slaap houd je hem haalbaar.'}</p>`;
  } else el('afsluiting').innerHTML = `${kop}<p class="app-noot">Dit was de laatste dag van de week.</p>`;
}

const meld = tekst => { el('melding').textContent = tekst; el('melding').hidden = !tekst; if (tekst) setTimeout(() => { el('melding').hidden = true; }, 4200); };
async function wijzig(id, data) {
  try { await api('PATCH', `/api/blokken/${id}`, data); await laad(); teken(); }
  catch (f) { meld(foutTekst(f)); }
}

document.addEventListener('click', async e => {
  const knop = e.target.closest('button');
  if (!knop) return;
  if (knop.dataset.datum) { gekozen = knop.dataset.datum; return teken(); }
  if (knop.id === 'laad-voorbeeld') {
    try { await api('POST', '/api/voorbeeld', { maandag: maandagVan(VANDAAG) }); await laad(); teken(); } catch (f) { meld(foutTekst(f)); }
    return;
  }
  const id = knop.dataset.blok, blok = blokken.find(b => b.id === id);
  if (knop.dataset.actie === 'laat') { genegeerd.add(id); return teken(); }
  if (knop.dataset.actie === 'gedaan') return wijzig(id, { status: blok.status === 'gedaan' ? 'gepland' : 'gedaan' });
  if (knop.dataset.actie === 'schuif') return wijzig(id, { start: Number(knop.dataset.start), einde: Number(knop.dataset.einde) });
  if (knop.dataset.actie === 'pas') {
    const s = rekenen().l.suggesties.find(x => x.blokId === id);
    if (!s) return;
    if (s.soort === 'lichter') return wijzig(id, { titel: s.vervanging?.titel ?? blok.titel, einde: s.vervanging?.einde ?? blok.einde, zwaar: false });
    // Verplaatsen naar de dag met ruimte; zonder zo'n dag laten we het vandaag liggen (status
    // "geschrapt": het blok blijft bestaan, het staat alleen niet meer in je agenda).
    return wijzig(id, s.naarDatum ? { datum: s.naarDatum } : { status: 'geschrapt' });
  }
});

// Slaap en energie: direct doorrekenen, en (met toestemming) kort daarna bewaren.
let bewaarTimer;
function bewaar() {
  const pr = profielVoor(gekozen);
  clearTimeout(bewaarTimer);
  if (!toestemming) return;
  bewaarTimer = setTimeout(async () => {
    try { const c = await api('PUT', `/api/checkins/${gekozen}`, { slaapMinuten: pr.slaapGisteren, energie: pr.energie }); checkins[gekozen] = c; delete lokaal[gekozen]; teken(); }
    catch (f) { meld(foutTekst(f)); }
  }, 500);
}
document.addEventListener('input', e => {
  if (e.target.id === 'slaap') { lokaal[gekozen] = { ...profielVoor(gekozen), slaap: Number(e.target.value) }; teken(); bewaar(); }
  if (e.target.name === 'energie') { lokaal[gekozen] = { ...profielVoor(gekozen), slaap: profielVoor(gekozen).slaapGisteren, energie: Number(e.target.value) }; teken(); bewaar(); }
});

try { await laad(); teken(); } catch (f) { if (f.status !== 401) meld(foutTekst(f)); }
