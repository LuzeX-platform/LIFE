import { haalbaarheid, lieverNiet, botsingen, weekBalans, klok, duur, weekdag } from '/planner/index.js';
import { api, esc, foutTekst, hoofdletter, koppelUitloggen, maandagVan, status, vandaag, weekVan } from '/api.js';

koppelUitloggen();

const el = id => document.getElementById(id);
const VANDAAG = vandaag();
const dagenIso = weekVan(VANDAAG);
const label = { haalbaar: 'Haalbaar', krap: 'Krap', 'te vol': 'Te vol' };
const datumTekst = d => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

// Toestand. Alles wat de gebruiker invult staat op de server; hier staat alleen de weergave
// ervan, plus wat nog niet bewaard kan worden (slaap en energie zonder toestemming).
let profiel, blokken = [], checkins = {}, toestemming = false;
const lokaal = {}, genegeerd = new Set();
// Eén pagina voor dag, week en dashboard: "de dag" is altijd vandaag. Een dag kiezen kan niet
// meer; de weekindeling hieronder laat de andere dagen zien.
const gekozen = VANDAAG;

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

  tekenWeek();
  tekenDashboard();
}

// Per dag van de week alles wat de panelen nodig hebben, in één keer uitgerekend.
function weekRekenen() {
  return dagenIso.map(d => {
    const bl = blokkenVan(d), pr = profielVoor(d);
    const l = lieverNiet(bl, pr, { dagen: dagen(), datum: d });
    const suggesties = d === gekozen ? l.suggesties.filter(x => !genegeerd.has(x.blokId)) : l.suggesties;
    return { datum: d, bl, pr, h: haalbaarheid(bl, pr), suggesties, bots: botsingen(bl, pr) };
  });
}
const telbaar = bl => bl.filter(b => b.soort !== 'reis');
const gemiddelde = lijst => lijst.length ? Math.round(lijst.reduce((a, b) => a + b, 0) / lijst.length) : null;

function tekenWeek() {
  const w = weekRekenen();
  const mooi = d => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  el('week-info').textContent = `${mooi(dagenIso[0])} tot en met ${mooi(dagenIso[6])}`;
  el('weekraster').innerHTML = w.map(d => {
    const lijst = d.bl.slice().sort((a, b) => a.start - b.start);
    return `<section class="weekdag" ${d.datum === gekozen ? 'aria-current="date"' : ''} aria-label="${esc(hoofdletter(datumTekst(d.datum)))}">
      <header><b>${esc(weekdag(d.datum).slice(0, 2))} ${Number(d.datum.slice(8))}</b><span class="${status(d.h.oordeel)}">${lijst.length ? d.h.score : '–'}</span></header>
      ${lijst.length ? `<ol>${lijst.map(b => `<li class="${b.soort === 'reis' ? 'reis' : ''} ${b.status === 'gedaan' ? 'klaar' : ''}"><time>${klok(b.start)}</time><span>${esc(b.titel)}</span></li>`).join('')}</ol>` : '<p class="app-noot">Niets gepland.</p>'}
    </section>`;
  }).join('');
}

function tekenDashboard() {
  const w = weekRekenen(), vandaagDag = w.find(d => d.datum === gekozen);
  const metBlokken = w.filter(d => d.bl.length);
  const gemScore = gemiddelde(metBlokken.map(d => d.h.score));
  const totaal = w.flatMap(d => telbaar(d.bl)), klaar = totaal.filter(b => b.status === 'gedaan').length;
  const slaapDagen = w.filter(d => heeftCheckin(d.datum)).map(d => d.pr.slaapGisteren);
  const gemSlaap = gemiddelde(slaapDagen);
  const bots = w.reduce((n, d) => n + d.bots.length, 0), liever = w.reduce((n, d) => n + d.suggesties.length, 0);
  const tegel = (naam, waarde, klasse = '', toelichting = '') =>
    `<div><dt>${naam}</dt><dd class="${klasse}">${waarde}</dd>${toelichting ? `<small>${toelichting}</small>` : ''}</div>`;
  el('kpis').innerHTML = `<dl>
    ${tegel('Vandaag', blokken.length && vandaagDag.bl.length ? vandaagDag.h.score : '–', vandaagDag.bl.length ? status(vandaagDag.h.oordeel) : '', vandaagDag.bl.length ? label[vandaagDag.h.oordeel] : 'Nog niets gepland')}
    ${tegel('Gemiddelde week', gemScore ?? '–', gemScore === null ? '' : status(gemScore >= 80 ? 'haalbaar' : gemScore >= 60 ? 'krap' : 'te vol'), metBlokken.length ? `${metBlokken.length} dagen met een plan` : 'Nog geen plan')}
    ${tegel('Afgevinkt', `${klaar} van ${totaal.length}`, '', 'blokken deze week')}
    ${tegel('Gemiddelde slaap', gemSlaap === null ? '–' : duur(gemSlaap), '', gemSlaap === null ? 'Nog geen check-ins' : `doel ${duur(profiel.slaapDoel)}`)}
    ${tegel('Liever niet', liever, '', liever === 1 ? 'suggestie deze week' : 'suggesties deze week')}
    ${tegel('Botsingen', bots, bots ? 'bots' : '', bots === 1 ? 'afspraak botst' : 'afspraken botsen')}
  </dl>`;

  const doelen = profiel.weekDoelen || {};
  const rijen = Object.keys(doelen).length ? weekBalans(w.map(d => ({ datum: d.datum, blokken: d.bl })), doelen) : [];
  const MAX = Math.max(1, ...rijen.flatMap(r => [r.gepland, r.doel]));
  el('balans-lijst').innerHTML = rijen.map(r => `<li class="week"><span class="naam">${esc(r.soort.replace('-', ' '))}</span>
    <div class="staaf" role="img" aria-label="${esc(r.soort)}: ${duur(r.gepland)} van ${duur(r.doel)}"><b style="width:${Math.round(100 * r.gepland / MAX)}%"></b><i style="left:${Math.round(100 * r.doel / MAX)}%"></i></div>
    <span class="getal ${r.status === 'achter' ? 'achter' : ''}">${duur(r.gepland)} / ${duur(r.doel)}</span></li>`).join('');
  const achter = rijen.filter(r => r.status === 'achter').map(r => r.soort.replace('-', ' '));
  el('balans-noot').innerHTML = !rijen.length ? 'Je hebt nog geen weekdoelen. <a href="/invullen.html#jij">Stel ze in</a>, dan zie je hier waar je achterloopt.'
    : achter.length ? `Achter op je doel: ${achter.join(', ')}. Het streepje op de balk is het doel.` : 'Alles ligt op koers.';

  // Slaap tegenover het doel; de energie van die ochtend staat achter het getal.
  const SLAAPMAX = Math.max(1, profiel.slaapDoel, ...w.map(d => d.pr.slaapGisteren));
  el('slaap-lijst').innerHTML = w.map(d => {
    const bekend = heeftCheckin(d.datum), m = d.pr.slaapGisteren;
    return `<li class="week"><span class="naam">${esc(weekdag(d.datum).slice(0, 2))} ${Number(d.datum.slice(8))}</span>
      <div class="staaf" role="img" aria-label="${bekend ? `Slaap ${duur(m)}, doel ${duur(profiel.slaapDoel)}` : 'Geen check-in'}"><b style="width:${bekend ? Math.round(100 * m / SLAAPMAX) : 0}%"></b><i style="left:${Math.round(100 * profiel.slaapDoel / SLAAPMAX)}%"></i></div>
      <span class="getal ${bekend && m < profiel.slaapDoel - 60 ? 'achter' : ''}">${bekend ? `${duur(m)} · ${d.pr.energie}/5` : '–'}</span></li>`;
  }).join('');
  el('slaap-noot').innerHTML = slaapDagen.length
    ? 'Het streepje is je slaapdoel, het cijfer erachter de energie van die ochtend.'
    : toestemming ? 'Vul bij “Hoe haalbaar is vandaag?” je slaap en energie in, dan bouwt dit overzicht zich op.'
      : 'Slaap en energie worden alleen bewaard met je toestemming. <a href="/invullen.html#gegevens">Geef toestemming</a>.';

  el('weekdagen').innerHTML = w.map(d => `<li class="weekdag-rij"><span class="dagnaam">${esc(weekdag(d.datum).slice(0, 2))} ${Number(d.datum.slice(8))}</span>
      <span class="maat ${status(d.h.oordeel)}" style="margin:0"><b style="width:${d.bl.length ? d.h.score : 0}%"></b></span><span class="getal ${status(d.h.oordeel)}">${d.bl.length ? d.h.score : '–'}</span></li>`).join('');
  const tel = [...metBlokken].sort((a, b) => a.h.score - b.h.score);
  el('dagen-noot').textContent = tel.length > 1 && tel[0].h.score < 80
    ? `${hoofdletter(weekdag(tel[0].datum))} is je zwaarste dag (${tel[0].h.score}). ${hoofdletter(weekdag(tel.at(-1).datum))} heeft de meeste lucht (${tel.at(-1).h.score}).`
    : tel.length ? 'Geen dag die wringt.' : 'Zodra er iets in je agenda staat, zie je hier welke dag wringt.';
}

const meld = tekst => { el('melding').textContent = tekst; el('melding').hidden = !tekst; if (tekst) setTimeout(() => { el('melding').hidden = true; }, 4200); };
async function wijzig(id, data) {
  try { await api('PATCH', `/api/blokken/${id}`, data); await laad(); teken(); }
  catch (f) { meld(foutTekst(f)); }
}

document.addEventListener('click', async e => {
  const knop = e.target.closest('button');
  if (!knop) return;
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
