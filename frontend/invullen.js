import { api, esc, foutTekst, klokNaarMin, koppelUitloggen, leesDuur, maandagVan, plusDagen, toonDuur, vandaag, weekVan } from '/api.js';
import { klok, duur, opTijd } from '/planner/index.js';
import { leesIcs, raadSoort } from '/planner/agendaImport.js';

koppelUitloggen();
const el = id => document.getElementById(id);
const SOORTEN = ['werk', 'school', 'gezin', 'sport', 'vrienden', 'vrije-tijd', 'reis', 'overig'];
const naam = s => s.replace('-', ' ');
const meld = (id, tekst, goed = false) => { const m = el(id); m.textContent = tekst; m.className = `melding-in ${goed ? 'goed' : ''}`; };
let weekStart = maandagVan(vandaag()), toestemming = false;

// ── Jij ──
const WEEKSOORTEN = ['werk', 'gezin', 'sport', 'vrienden', 'school', 'vrije-tijd'];
async function laadProfiel() {
  const p = await api('GET', '/api/profiel');
  el('wakker-van').value = klok(p.wakkerVan); el('wakker-tot').value = klok(p.wakkerTot); el('slaapdoel').value = toonDuur(p.slaapDoel);
  el('weekdoelen').innerHTML = WEEKSOORTEN.map(s => `<label for="doel-${s}">${esc(naam(s))}<input id="doel-${s}" data-soort="${s}" inputmode="numeric" placeholder="bijv. 6:00" value="${p.weekDoelen?.[s] != null ? toonDuur(p.weekDoelen[s]) : ''}"></label>`).join('');
}
el('profiel-form').addEventListener('submit', async e => {
  e.preventDefault();
  const slaapDoel = leesDuur(el('slaapdoel').value);
  const weekDoelen = {};
  for (const i of document.querySelectorAll('#weekdoelen input')) {
    if (!i.value.trim()) continue;
    const m = leesDuur(i.value);
    if (m === null) return meld('profiel-melding', `“${i.value}” bij ${naam(i.dataset.soort)} is geen tijd. Schrijf het als uren:minuten, bijvoorbeeld 6:30.`);
    weekDoelen[i.dataset.soort] = m;
  }
  if (slaapDoel === null) return meld('profiel-melding', 'Je slaapdoel is geen tijd. Schrijf het als 7:30.');
  try { await api('PUT', '/api/profiel', { wakkerVan: klokNaarMin(el('wakker-van').value), wakkerTot: klokNaarMin(el('wakker-tot').value), slaapDoel, weekDoelen }); meld('profiel-melding', 'Opgeslagen.', true); }
  catch (f) { meld('profiel-melding', f.data?.fouten?.fieldErrors?.wakkerTot || f.data?.fouten?.formErrors?.[0] || foutTekst(f)); }
});

// ── Agenda ──
el('soort').innerHTML = SOORTEN.map(s => `<option value="${s}">${esc(naam(s))}</option>`).join('');
el('datum').value = vandaag();
async function laadWeek() {
  const dagen = weekVan(weekStart);
  const blokken = await api('GET', `/api/blokken?van=${dagen[0]}&tot=${dagen[6]}`);
  const mooi = d => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  el('week-titel').textContent = `${mooi(dagen[0])} – ${mooi(dagen[6])}`;
  el('voorbeeld-rij').hidden = blokken.length > 0;
  el('agenda-lijst').innerHTML = dagen.map(d => {
    const bl = opTijd(blokken.filter(b => b.datum === d));
    const dag = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
    return `<li class="agenda-dag"><h4>${esc(dag)}</h4>${bl.length ? `<ul>${bl.map(b => `<li><time>${klok(b.start)}–${klok(b.einde)}</time><span>${esc(b.titel)}<small>${esc(naam(b.soort))}${b.vast ? ' · vast' : ''}${b.persoon ? ' · met iemand' : ''}</small></span><button class="klein" type="button" data-schrap="${esc(b.id)}" aria-label="${esc(b.titel)} uit je agenda halen">Haal weg</button></li>`).join('')}</ul>` : '<p class="app-noot">Niets ingepland.</p>'}</li>`;
  }).join('');
}
el('week-vorige').addEventListener('click', () => { weekStart = plusDagen(weekStart, -7); laadWeek(); });
el('week-volgende').addEventListener('click', () => { weekStart = plusDagen(weekStart, 7); laadWeek(); });
el('agenda-lijst').addEventListener('click', async e => {
  const id = e.target.closest('[data-schrap]')?.dataset.schrap;
  if (id) { await api('PATCH', `/api/blokken/${id}`, { status: 'geschrapt' }); laadWeek(); }
});
el('voorbeeld-knop').addEventListener('click', async () => {
  try { await api('POST', '/api/voorbeeld', { maandag: weekStart }); await Promise.all([laadWeek(), laadProfiel()]); } catch (f) { meld('blok-melding', foutTekst(f)); }
});
el('zwaar').addEventListener('change', () => { el('lichter-velden').hidden = !el('zwaar').checked; });
el('blok-form').addEventListener('submit', async e => {
  e.preventDefault();
  const start = klokNaarMin(el('start').value), einde = klokNaarMin(el('einde').value);
  if (!el('titel').value.trim()) return meld('blok-melding', 'Geef het blok een naam.');
  if (!(einde > start)) return meld('blok-melding', 'Het einde moet na de start liggen.');
  const lichterDuur = leesDuur(el('lichter-duur').value);
  const lichter = el('zwaar').checked && el('lichter-titel').value.trim() && lichterDuur ? { titel: el('lichter-titel').value.trim(), duur: lichterDuur } : null;
  try {
    await api('POST', '/api/blokken', { datum: el('datum').value, titel: el('titel').value.trim(), soort: el('soort').value, start, einde, plek: el('blok-plek').value.trim() || null,
      vast: el('vast').checked, persoon: el('persoon').checked, uitstelbaar: el('uitstelbaar').checked, zwaar: el('zwaar').checked, lichter });
    meld('blok-melding', 'Toegevoegd.', true);
    el('titel').value = ''; el('blok-plek').value = '';
    weekStart = maandagVan(el('datum').value); await laadWeek();
  } catch (f) { meld('blok-melding', foutTekst(f)); }
});

// ── Agenda inladen ──
// Het bestand wordt hier gelezen en nooit als geheel verstuurd. Alleen titel, tijd, plek en een
// sleutel (om dubbel inladen te herkennen) van de afspraken die de gebruiker bevestigt gaan mee.
let icsTekst = null, gevonden = [];
el('import-van').value = weekStart; el('import-tot').value = plusDagen(weekStart, 55);
const MAX_DAGEN = 120;
function lees() {
  if (icsTekst === null) return;
  const van = el('import-van').value, tot = el('import-tot').value;
  if (!van || !tot || tot < van) return meld('import-melding', 'Kies een periode waarvan het einde na het begin ligt.');
  if ((Date.parse(`${tot}T12:00:00Z`) - Date.parse(`${van}T12:00:00Z`)) / 86400000 > MAX_DAGEN) return meld('import-melding', `Kies een periode van hoogstens ${MAX_DAGEN} dagen.`);
  const r = leesIcs(icsTekst, { van, tot });
  gevonden = r.afspraken.map(a => ({ ...a, soort: raadSoort(a.titel), aan: true }));
  meld('import-melding', '');
  el('import-resultaat').hidden = false;
  const deel = [];
  if (r.overgeslagen.heleDag) deel.push(`${r.overgeslagen.heleDag} hele-dag-afspraken`);
  if (r.overgeslagen.geannuleerd) deel.push(`${r.overgeslagen.geannuleerd} geannuleerde`);
  el('import-samenvatting').textContent = gevonden.length
    ? `${gevonden.length} afspraken gevonden${deel.length ? `. Overgeslagen: ${deel.join(', ')}` : ''}.${r.opmerkingen.length ? ` ${r.opmerkingen.join(' ')}` : ''}`
    : `Geen afspraken gevonden in deze periode.${deel.length ? ` Overgeslagen: ${deel.join(', ')}.` : ''}`;
  el('import-lijst').innerHTML = gevonden.map((a, i) => `<div class="import-rij"><label class="import-aan"><input type="checkbox" data-i="${i}" checked aria-label="${esc(a.titel)} meenemen"></label>
    <span class="import-tijd">${esc(a.datum.slice(8))}-${esc(a.datum.slice(5, 7))} ${klok(a.start)}</span><span class="import-titel">${esc(a.titel)}${a.deelnemers ? '<small>met iemand</small>' : ''}</span>
    <select data-soort="${i}" aria-label="Soort van ${esc(a.titel)}">${SOORTEN.map(s => `<option value="${s}"${s === a.soort ? ' selected' : ''}>${esc(naam(s))}</option>`).join('')}</select></div>`).join('');
  tekenImportKnop();
}
function tekenImportKnop() {
  const n = gevonden.filter(a => a.aan).length;
  el('import-knop').textContent = n === 1 ? 'Voeg 1 afspraak toe' : `Voeg ${n} afspraken toe`;
  el('import-knop').disabled = n === 0;
}
el('import-bestand').addEventListener('change', async () => {
  const f = el('import-bestand').files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) return meld('import-melding', 'Dit bestand is te groot (meer dan 5 MB). Exporteer een kortere periode.');
  icsTekst = await f.text();
  if (!/BEGIN:VCALENDAR/i.test(icsTekst)) { icsTekst = null; return meld('import-melding', 'Dit lijkt geen agendabestand (.ics).'); }
  lees();
});
el('import-van').addEventListener('change', lees); el('import-tot').addEventListener('change', lees);
el('import-lijst').addEventListener('change', e => {
  const i = e.target.dataset.i ?? e.target.dataset.soort; if (i === undefined) return;
  if (e.target.dataset.i !== undefined) gevonden[i].aan = e.target.checked; else gevonden[i].soort = e.target.value;
  tekenImportKnop();
});
el('import-form').addEventListener('submit', async e => {
  e.preventDefault();
  const keuze = gevonden.filter(a => a.aan);
  if (!keuze.length) return;
  el('import-knop').disabled = true;
  try {
    let nieuw = 0, over = 0;
    for (let i = 0; i < keuze.length; i += 400) {
      const r = await api('POST', '/api/blokken/importeren', { afspraken: keuze.slice(i, i + 400).map(a => ({ datum: a.datum, titel: a.titel, soort: a.soort, start: a.start, einde: a.einde, vast: true, persoon: a.deelnemers > 0, plek: a.plek, sleutel: a.sleutel })) });
      nieuw += r.nieuw; over += r.overgeslagen;
    }
    meld('import-melding', `${nieuw} afspraken toegevoegd${over ? `, ${over} stonden er al` : ''}. Kijk bij Vandaag wat het met je dagen doet.`, true);
    el('import-resultaat').hidden = true; el('import-bestand').value = ''; icsTekst = null; gevonden = [];
    weekStart = maandagVan(keuze[0].datum); await laadWeek();
  } catch (f) { meld('import-melding', foutTekst(f)); el('import-knop').disabled = false; }
});
// Alleen aanwezig in het voorbeeld, om zonder eigen bestand te kunnen proberen.
if (window.__icsVoorbeeld) {
  el('import-voorbeeld').hidden = false; el('import-resultaat').hidden = false;
  el('import-voorbeeld').addEventListener('click', () => { icsTekst = window.__icsVoorbeeld(); lees(); });
}

// ── Vanochtend ──
async function laadCheckin() {
  const c = (await api('GET', `/api/checkins?van=${vandaag()}&tot=${vandaag()}`))[0];
  el('checkin-slaap').value = c ? toonDuur(c.slaapMinuten) : '';
  for (const r of document.querySelectorAll('input[name=energie]')) r.checked = c ? Number(r.value) === c.energie : false;
  el('checkin-zonder').hidden = toestemming; el('checkin-form').hidden = !toestemming;
}
el('checkin-form').addEventListener('submit', async e => {
  e.preventDefault();
  const slaap = leesDuur(el('checkin-slaap').value), energie = document.querySelector('input[name=energie]:checked')?.value;
  if (slaap === null || slaap > 900) return meld('checkin-melding', 'Schrijf je slaap als uren:minuten, bijvoorbeeld 6:40.');
  if (!energie) return meld('checkin-melding', 'Kies hoe je energie is, van 1 tot 5.');
  try { await api('PUT', `/api/checkins/${vandaag()}`, { slaapMinuten: slaap, energie: Number(energie) }); meld('checkin-melding', 'Opgeslagen. Kijk bij Vandaag wat het met je dag doet.', true); }
  catch (f) { meld('checkin-melding', foutTekst(f)); }
});

// ── Je gegevens ──
function tekenToestemming() {
  el('toestemming-tekst').textContent = toestemming ? 'Je hebt toestemming gegeven om slaap en energie te bewaren.' : 'Je hebt geen toestemming gegeven. Slaap en energie worden niet bewaard.';
  el('toestemming-knop').textContent = toestemming ? 'Toestemming intrekken en check-ins wissen' : 'Toestemming geven';
}
el('toestemming-knop').addEventListener('click', async () => {
  const volgende = !toestemming;
  try { await api('POST', '/api/account/toestemming', { gegeven: volgende }); toestemming = volgende; tekenToestemming(); laadCheckin(); } catch (f) { meld('gegevens-melding', foutTekst(f)); }
});
el('verwijder-form').addEventListener('submit', async e => {
  e.preventDefault();
  try { await api('POST', '/api/account/verwijderen', { wachtwoord: el('verwijder-ww').value }); location.href = '/inloggen.html'; }
  catch (f) { meld('verwijder-melding', foutTekst(f)); }
});

try {
  const ik = await api('GET', '/api/auth/ik'); toestemming = ik.toestemmingGezondheid;
  el('mijn-email').textContent = ik.email; tekenToestemming();
  await Promise.all([laadProfiel(), laadWeek(), laadCheckin()]);
} catch (f) { if (f.status !== 401) meld('gegevens-melding', foutTekst(f)); }
