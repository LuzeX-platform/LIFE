import { api, esc, foutTekst, klokNaarMin, koppelUitloggen, leesDuur, maandagVan, plusDagen, toonDuur, vandaag, weekVan } from '/api.js';
import { klok, duur, opTijd } from '/planner/index.js';

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
