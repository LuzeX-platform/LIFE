// Leest een .ics-bestand (iCalendar, RFC 5545) zoals Apple, Google en Outlook dat exporteren, en
// maakt er afspraken van in de tijdzone van de gebruiker. Gewone JavaScript zonder afhankelijkheden:
// het draait in de browser, zodat het bestand zelf (met deelnemers van anderen erin) nooit naar de
// server hoeft. Alleen titel, tijd en plek van de afspraken die jij bevestigt gaan mee.
//
// Bewust ondersteund: tijdzones (TZID en UTC), terugkerende afspraken (DAILY, WEEKLY met BYDAY,
// MONTHLY op dezelfde dag, YEARLY, met INTERVAL, COUNT, UNTIL en EXDATE), gewijzigde afspraken uit
// een reeks (RECURRENCE-ID) en afspraken over middernacht heen. Overgeslagen: hele-dag-afspraken en
// geannuleerde afspraken. Niet ondersteund (met een melding): regels als "elke tweede dinsdag van
// de maand"; van zo'n reeks komt alleen de eerste afspraak mee.
//
// Overwogen en afgevallen: een bestaande bibliotheek (ical.js). Die is groot, en we hebben maar een
// kleine deelverzameling nodig; de tests hieronder leggen vast wat wél en niet wordt ondersteund.

export const STANDAARD_TIJDZONE = 'Europe/Amsterdam';
const MAX_AFSPRAKEN = 2000;

// Outlook exporteert Windows-namen voor tijdzones.
const WINDOWS_ZONES = {
  'W. Europe Standard Time': 'Europe/Amsterdam', 'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
  'GMT Standard Time': 'Europe/London', 'UTC': 'UTC', 'Greenwich Standard Time': 'UTC',
};

const dagNummer = (j, m, d) => Math.floor(Date.UTC(j, m - 1, d) / 86400000);
const uitDagNummer = n => { const d = new Date(n * 86400000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
const isoVan = n => { const [j, m, d] = uitDagNummer(n); return `${j}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const dagNrVanIso = iso => dagNummer(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));
const weekdag = n => (new Date(n * 86400000).getUTCDay() + 6) % 7; // 0 = maandag

function geldigeZone(naam) {
  const n = WINDOWS_ZONES[naam] || naam;
  try { new Intl.DateTimeFormat('nl-NL', { timeZone: n }); return n; } catch { return null; }
}

// De verschuiving van een tijdzone ten opzichte van UTC op een gegeven moment, in milliseconden.
function offsetMs(ms, zone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
/** Wandkloktijd in een zone naar een moment (ms sinds 1970). Twee ronden voor de uren rond de zomertijdwissel. */
function instant(j, m, d, u, min, zone) {
  const gok = Date.UTC(j, m - 1, d, u, min);
  const eerste = gok - offsetMs(gok, zone);
  return gok - offsetMs(eerste, zone);
}
/** Een moment naar datum en minuten sinds middernacht in een zone. */
function wandklok(ms, zone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, +x.value]));
  return { dag: dagNummer(p.year, p.month, p.day), minuut: p.hour * 60 + p.minute };
}

function ontvouw(tekst) {
  return tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter(r => r.trim());
}
function leesRegel(r) {
  const dubbel = (() => { let q = false; for (let i = 0; i < r.length; i++) { if (r[i] === '"') q = !q; else if (r[i] === ':' && !q) return i; } return -1; })();
  if (dubbel < 0) return null;
  const [naam, ...delen] = r.slice(0, dubbel).split(';');
  const params = {};
  for (const d of delen) { const i = d.indexOf('='); if (i > 0) params[d.slice(0, i).toUpperCase()] = d.slice(i + 1).replace(/^"|"$/g, ''); }
  return { naam: naam.toUpperCase(), params, waarde: r.slice(dubbel + 1) };
}
const tekstWaarde = w => w.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** "20261013T090000Z" of met TZID of "20261013" (hele dag). */
function leesTijd(regel, doelZone, opmerkingen) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(regel.waarde.trim());
  if (!m) return null;
  const [, j, mo, d, u, mi, , z] = m;
  if (u === undefined) return { heleDag: true, dag: dagNummer(+j, +mo, +d) };
  let ms, wandZone;
  if (z) { ms = Date.UTC(+j, +mo - 1, +d, +u, +mi); wandZone = 'UTC'; }
  else if (regel.params.TZID) {
    wandZone = geldigeZone(regel.params.TZID);
    if (!wandZone) { opmerkingen.add(`Onbekende tijdzone “${regel.params.TZID}”: we rekenen met ${doelZone}.`); wandZone = doelZone; }
    ms = instant(+j, +mo, +d, +u, +mi, wandZone);
  } else { wandZone = doelZone; ms = instant(+j, +mo, +d, +u, +mi, doelZone); } // zwevende tijd
  return { heleDag: false, ms, wandZone, wand: { j: +j, mo: +mo, d: +d, u: +u, mi: +mi } };
}
function leesDuur(w) {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(w.trim());
  if (!m) return null;
  return ((+m[1] || 0) * 7 * 1440 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0)) * 60000;
}
function leesRrule(w) {
  const r = Object.fromEntries(w.split(';').map(x => x.split('=')));
  return { freq: r.FREQ, interval: +(r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : null, until: r.UNTIL || null, byday: r.BYDAY ? r.BYDAY.split(',') : null, bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null, byother: Boolean(r.BYSETPOS || r.BYWEEKNO || r.BYYEARDAY || (r.BYMONTH && r.FREQ !== 'YEARLY')) };
}
const DAGEN = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

/** De dagnummers (in de wandklok van de afspraak zelf) waarop een terugkerende afspraak valt. */
function* herhalingen(start, regel, totDag, opmerkingen) {
  const eerste = dagNummer(start.wand.j, start.wand.mo, start.wand.d), startDag = uitDagNummer(eerste);
  const ondersteund = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(regel.freq) && !regel.byother &&
    !(regel.byday && regel.freq !== 'WEEKLY' && regel.byday.some(x => /\d/.test(x)));
  if (!ondersteund) { opmerkingen.add('Een terugkerende afspraak met een ingewikkelde regel (bijvoorbeeld “elke tweede dinsdag”) is niet helemaal over te nemen; alleen de eerste is meegenomen.'); yield eerste; return; }
  const maandagStart = eerste - weekdag(eerste);
  const untilDag = regel.until ? dagNrVanIso(`${regel.until.slice(0, 4)}-${regel.until.slice(4, 6)}-${regel.until.slice(6, 8)}`) : Infinity;
  let teller = 0;
  for (let n = eerste; n <= totDag && n <= untilDag; n++) {
    const [j, m, d] = uitDagNummer(n);
    let valt = false;
    if (regel.freq === 'DAILY') valt = (n - eerste) % regel.interval === 0;
    else if (regel.freq === 'WEEKLY') {
      const dagen = regel.byday ? regel.byday.map(x => DAGEN[x.slice(-2)]) : [weekdag(eerste)];
      valt = Math.floor((n - weekdag(n) - maandagStart) / 7) % regel.interval === 0 && dagen.includes(weekdag(n));
    } else if (regel.freq === 'MONTHLY') {
      const maanden = (j - startDag[0]) * 12 + (m - startDag[1]);
      valt = maanden % regel.interval === 0 && (regel.bymonthday ? regel.bymonthday.includes(d) : d === startDag[2]);
    } else valt = ((j - startDag[0]) % regel.interval === 0) && m === startDag[1] && d === startDag[2];
    if (!valt) continue;
    if (regel.count && ++teller > regel.count) return;
    yield n;
  }
}

/**
 * @param {string} tekst inhoud van het .ics-bestand
 * @param {{van: string, tot: string, tijdzone?: string}} opties periode als "2026-10-12" (inclusief)
 * @returns {{afspraken: {datum:string,start:number,einde:number,titel:string,plek:string|null,deelnemers:number,sleutel:string}[], overgeslagen:{heleDag:number,geannuleerd:number}, opmerkingen:string[]}}
 */
export function leesIcs(tekst, { van, tot, tijdzone = STANDAARD_TIJDZONE }) {
  const opmerkingen = new Set(), overgeslagen = { heleDag: 0, geannuleerd: 0 };
  const vanDag = dagNrVanIso(van), totDag = dagNrVanIso(tot);
  const events = [];
  let huidig = null;
  for (const r of ontvouw(tekst)) {
    if (r.trim() === 'BEGIN:VEVENT') { huidig = []; continue; }
    if (r.trim() === 'END:VEVENT') { if (huidig) events.push(huidig); huidig = null; continue; }
    if (!huidig) continue;
    const l = leesRegel(r); if (l) huidig.push(l);
  }
  const veld = (e, n) => e.find(x => x.naam === n);
  const velden = (e, n) => e.filter(x => x.naam === n);

  // Gewijzigde afspraken uit een reeks: de originele plek in de reeks wordt overgeslagen.
  const overschreven = new Set();
  for (const e of events) { const rid = veld(e, 'RECURRENCE-ID'), uid = veld(e, 'UID'); const t = rid && leesTijd(rid, tijdzone, opmerkingen); if (t && uid) overschreven.add(`${uid.waarde}|${t.heleDag ? t.dag : t.ms}`); }

  const uit = [];
  for (const e of events) {
    const uid = veld(e, 'UID')?.waarde || String(uit.length);
    if (veld(e, 'STATUS')?.waarde.trim().toUpperCase() === 'CANCELLED') { overgeslagen.geannuleerd++; continue; }
    const s = veld(e, 'DTSTART') && leesTijd(veld(e, 'DTSTART'), tijdzone, opmerkingen);
    if (!s) continue;
    if (s.heleDag) { overgeslagen.heleDag++; continue; }
    const eind = veld(e, 'DTEND') && leesTijd(veld(e, 'DTEND'), tijdzone, opmerkingen);
    const dur = veld(e, 'DURATION') && leesDuur(veld(e, 'DURATION').waarde);
    const lengteMs = eind && !eind.heleDag ? Math.max(0, eind.ms - s.ms) : dur ?? 3600000; // zonder einde: een uur
    if (lengteMs <= 0) continue;
    const titel = tekstWaarde(veld(e, 'SUMMARY')?.waarde || '').slice(0, 120) || 'Afspraak';
    const plek = tekstWaarde(veld(e, 'LOCATION')?.waarde || '').slice(0, 60) || null;
    // Deelnemers tellen we alleen; hun namen en adressen lezen we niet verder.
    const deelnemers = velden(e, 'ATTENDEE').length;
    const rrule = veld(e, 'RRULE'), isOverschrijving = Boolean(veld(e, 'RECURRENCE-ID'));

    const instanties = [];
    if (rrule && !isOverschrijving) {
      const uitgezonderd = new Set(velden(e, 'EXDATE').flatMap(x => x.waarde.split(',').map(w => { const t = leesTijd({ ...x, waarde: w }, tijdzone, opmerkingen); return t && (t.heleDag ? t.dag : t.ms); })));
      // De wandklok van de afspraak zelf blijft gelijk over de zomertijdwissel heen.
      for (const dagNr of herhalingen(s, leesRrule(rrule.waarde), totDag + 2, opmerkingen)) {
        const [j, m, d] = uitDagNummer(dagNr);
        const ms = instant(j, m, d, s.wand.u, s.wand.mi, s.wandZone);
        if (uitgezonderd.has(ms) || overschreven.has(`${uid}|${ms}`)) continue;
        instanties.push(ms);
      }
    } else instanties.push(s.ms);

    for (const ms of instanties) {
      const begin = wandklok(ms, tijdzone), einde = wandklok(ms + lengteMs, tijdzone);
      // Over middernacht: één afspraak per dag, zodat het dagplan er per dag mee kan rekenen.
      for (let dag = begin.dag; dag <= einde.dag; dag++) {
        const startMin = dag === begin.dag ? begin.minuut : 0;
        const eindMin = dag === einde.dag ? einde.minuut : 1440;
        if (eindMin <= startMin || dag < vanDag || dag > totDag) continue;
        uit.push({ datum: isoVan(dag), start: startMin, einde: eindMin, titel, plek, deelnemers, sleutel: `${uid}|${ms}|${dag}`.slice(0, 200) });
      }
    }
    if (uit.length > MAX_AFSPRAKEN) { opmerkingen.add(`Meer dan ${MAX_AFSPRAKEN} afspraken in deze periode; kies een kortere periode.`); break; }
  }
  uit.sort((a, b) => a.datum.localeCompare(b.datum) || a.start - b.start);
  return { afspraken: uit.slice(0, MAX_AFSPRAKEN), overgeslagen, opmerkingen: [...opmerkingen] };
}

// LIFE kan niet zien of "Training" sport is. Een gok op trefwoorden, die in het scherm zichtbaar is
// en per afspraak te wijzigen. Volgorde telt: "oudergesprek" is school, ook al staat er "gesprek".
const TREFWOORDEN = [
  ['reis', ['reistijd', 'reizen', 'trein', 'vlucht', 'woon-werk']],
  ['school', ['oudergesprek', 'ouderavond', 'school', 'tentamen', 'college', 'hoorcollege', 'cursus', 'les ']],
  ['sport', ['sport', 'training', 'hardlop', 'gym', 'fitness', 'yoga', 'zwemmen', 'voetbal', 'tennis', 'padel', 'wandel', 'fietstocht', 'pilates']],
  ['vrienden', ['borrel', 'etentje', 'diner', 'drinken', 'bbq', 'feestje', 'vrienden', 'koffie met']],
  ['gezin', ['zwemles', 'kinder', 'gezin', 'familie', 'opa', 'oma', 'kraam', 'verjaardag']],
  ['werk', ['overleg', 'meeting', 'standup', 'sprint', 'vergadering', 'klant', 'call', 'project', 'review', '1:1', 'team']],
];
export function raadSoort(titel) {
  const t = `${titel.toLowerCase()} `;
  for (const [soort, woorden] of TREFWOORDEN) if (woorden.some(w => t.includes(w))) return soort;
  return 'overig';
}
