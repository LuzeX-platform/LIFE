import test from 'node:test';
import assert from 'node:assert/strict';
import { leesIcs, raadSoort } from '../src/planner/agendaImport.js';

const kal = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR\r\n`;
const ev = (...regels) => `BEGIN:VEVENT\r\n${regels.join('\r\n')}\r\nEND:VEVENT`;
const periode = { van: '2026-10-01', tot: '2026-12-31' };
const klok = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

test('een gewone afspraak met tijdzone', () => {
  const r = leesIcs(kal(ev('UID:a1', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DTEND;TZID=Europe/Amsterdam:20261013T103000', 'SUMMARY:Overleg team', 'LOCATION:Kantoor')), periode);
  assert.equal(r.afspraken.length, 1);
  const a = r.afspraken[0];
  assert.deepEqual([a.datum, klok(a.start), klok(a.einde), a.titel, a.plek], ['2026-10-13', '09:00', '10:30', 'Overleg team', 'Kantoor']);
});

test('UTC wordt omgerekend, met zomertijd en wintertijd', () => {
  const zomer = leesIcs(kal(ev('UID:z', 'DTSTART:20260715T070000Z', 'DTEND:20260715T080000Z', 'SUMMARY:Zomer')), periode.van && { van: '2026-07-01', tot: '2026-07-31' });
  assert.equal(klok(zomer.afspraken[0].start), '09:00', 'zomer: UTC+2');
  const winter = leesIcs(kal(ev('UID:w', 'DTSTART:20261215T080000Z', 'DTEND:20261215T090000Z', 'SUMMARY:Winter')), periode);
  assert.equal(klok(winter.afspraken[0].start), '09:00', 'winter: UTC+1');
});

test('een andere tijdzone dan de jouwe: New York 09:00 is 15:00 in Amsterdam', () => {
  const r = leesIcs(kal(ev('UID:n', 'DTSTART;TZID=America/New_York:20261013T090000', 'DTEND;TZID=America/New_York:20261013T100000', 'SUMMARY:Call')), periode);
  assert.equal(klok(r.afspraken[0].start), '15:00');
});

test('Windows-tijdzonenamen van Outlook', () => {
  const r = leesIcs(kal(ev('UID:o', 'DTSTART;TZID=W. Europe Standard Time:20261013T090000', 'DTEND;TZID=W. Europe Standard Time:20261013T100000', 'SUMMARY:Outlook')), periode);
  assert.equal(klok(r.afspraken[0].start), '09:00');
  assert.deepEqual(r.opmerkingen, []);
});

test('hele-dag-afspraken en geannuleerde afspraken worden overgeslagen en geteld', () => {
  const r = leesIcs(kal([ev('UID:h', 'DTSTART;VALUE=DATE:20261013', 'SUMMARY:Verjaardag'), ev('UID:c', 'DTSTART:20261014T080000Z', 'DTEND:20261014T090000Z', 'STATUS:CANCELLED', 'SUMMARY:Afgezegd'), ev('UID:g', 'DTSTART:20261015T080000Z', 'DTEND:20261015T090000Z', 'SUMMARY:Blijft')].join('\r\n')), periode);
  assert.equal(r.afspraken.length, 1); assert.equal(r.overgeslagen.heleDag, 1); assert.equal(r.overgeslagen.geannuleerd, 1);
});

test('tekst: opgevouwen regels en escapes', () => {
  const r = leesIcs(kal(ev('UID:t', 'DTSTART:20261013T080000Z', 'DTEND:20261013T090000Z', 'SUMMARY:Lunch met Sanne\\, Joost en\r\n  de rest', 'LOCATION:Café\; Utrecht')), periode);
  assert.equal(r.afspraken[0].titel, 'Lunch met Sanne, Joost en de rest');
  assert.equal(r.afspraken[0].plek, 'Café; Utrecht');
});

test('deelnemers worden geteld, niet gelezen', () => {
  const r = leesIcs(kal(ev('UID:d', 'DTSTART:20261013T080000Z', 'DTEND:20261013T090000Z', 'SUMMARY:Overleg', 'ATTENDEE;CN=Jan:mailto:jan@x.nl', 'ATTENDEE;CN=Piet:mailto:piet@x.nl')), periode);
  assert.equal(r.afspraken[0].deelnemers, 2);
  assert.ok(!JSON.stringify(r).includes('jan@x.nl'), 'adressen komen nergens in het resultaat');
});

test('wekelijks terugkerend met BYDAY, COUNT en een uitzondering', () => {
  const r = leesIcs(kal(ev('UID:w', 'DTSTART;TZID=Europe/Amsterdam:20261012T180000', 'DTEND;TZID=Europe/Amsterdam:20261012T190000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=Europe/Amsterdam:20261014T180000', 'SUMMARY:Training')), periode);
  // Zes keer (ma 12, wo 14, ma 19, wo 21, ma 26, wo 28), min de uitzondering op wo 14. COUNT telt de uitgezonderde mee.
  assert.deepEqual(r.afspraken.map(a => a.datum), ['2026-10-12', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']);
});

test('terugkerend tot UNTIL en met INTERVAL', () => {
  const r = leesIcs(kal(ev('UID:u', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DTEND;TZID=Europe/Amsterdam:20261013T100000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261110T000000Z', 'SUMMARY:Tweewekelijks')), periode);
  assert.deepEqual(r.afspraken.map(a => a.datum), ['2026-10-13', '2026-10-27', '2026-11-10']);
});

test('de wandklok blijft gelijk over de wissel naar wintertijd (25 oktober 2026)', () => {
  const r = leesIcs(kal(ev('UID:dst', 'DTSTART;TZID=Europe/Amsterdam:20261019T090000', 'DTEND;TZID=Europe/Amsterdam:20261019T100000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Elke maandag')), periode);
  assert.deepEqual(r.afspraken.map(a => [a.datum, klok(a.start)]), [['2026-10-19', '09:00'], ['2026-10-26', '09:00'], ['2026-11-02', '09:00']]);
});

test('een gewijzigde afspraak uit een reeks vervangt die van de reeks', () => {
  const r = leesIcs(kal([
    ev('UID:r', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DTEND;TZID=Europe/Amsterdam:20261013T100000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Standup'),
    ev('UID:r', 'RECURRENCE-ID;TZID=Europe/Amsterdam:20261020T090000', 'DTSTART;TZID=Europe/Amsterdam:20261020T140000', 'DTEND;TZID=Europe/Amsterdam:20261020T150000', 'SUMMARY:Standup (verplaatst)'),
  ].join('\r\n')), periode);
  assert.deepEqual(r.afspraken.map(a => [a.datum, klok(a.start)]), [['2026-10-13', '09:00'], ['2026-10-20', '14:00'], ['2026-10-27', '09:00']]);
});

test('een ingewikkelde regel geeft een melding en alleen de eerste afspraak', () => {
  const r = leesIcs(kal(ev('UID:m', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DTEND;TZID=Europe/Amsterdam:20261013T100000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:Maandoverleg')), periode);
  assert.equal(r.afspraken.length, 1); assert.equal(r.opmerkingen.length, 1);
});

test('een afspraak over middernacht wordt per dag gesplitst', () => {
  const r = leesIcs(kal(ev('UID:nacht', 'DTSTART;TZID=Europe/Amsterdam:20261016T223000', 'DTEND;TZID=Europe/Amsterdam:20261017T013000', 'SUMMARY:Feest')), periode);
  assert.deepEqual(r.afspraken.map(a => [a.datum, klok(a.start), klok(a.einde)]), [['2026-10-16', '22:30', '24:00'], ['2026-10-17', '00:00', '01:30']]);
});

test('alleen afspraken binnen de gekozen periode', () => {
  const r = leesIcs(kal([ev('UID:1', 'DTSTART:20260901T080000Z', 'DTEND:20260901T090000Z', 'SUMMARY:Te vroeg'), ev('UID:2', 'DTSTART:20261013T080000Z', 'DTEND:20261013T090000Z', 'SUMMARY:Erin')].join('\r\n')), { van: '2026-10-12', tot: '2026-10-18' });
  assert.deepEqual(r.afspraken.map(a => a.titel), ['Erin']);
});

test('zonder einde duurt een afspraak een uur; onzin in het bestand geeft geen fout', () => {
  const r = leesIcs(kal([ev('UID:z', 'DTSTART:20261013T080000Z', 'SUMMARY:Zonder einde'), ev('UID:k', 'DTSTART:onzin', 'SUMMARY:Kapot')].join('\r\n')) + '\r\nBEGIN:ONZIN', periode);
  assert.equal(r.afspraken.length, 1); assert.equal(r.afspraken[0].einde - r.afspraken[0].start, 60);
  assert.deepEqual(leesIcs('dit is geen agenda', periode).afspraken, []);
});

test('de sleutel is stabiel (zelfde bestand twee keer geeft dezelfde sleutels) en uniek per afspraak', () => {
  const tekst = kal(ev('UID:s', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DTEND;TZID=Europe/Amsterdam:20261013T100000', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Elke dag'));
  const a = leesIcs(tekst, periode).afspraken.map(x => x.sleutel), b = leesIcs(tekst, periode).afspraken.map(x => x.sleutel);
  assert.deepEqual(a, b); assert.equal(new Set(a).size, 3);
});

test('soort raden op trefwoorden', () => {
  assert.equal(raadSoort('Oudergesprek groep 5'), 'school');
  assert.equal(raadSoort('Padel met Joost'), 'sport');
  assert.equal(raadSoort('Teamoverleg'), 'werk');
  assert.equal(raadSoort('Borrel'), 'vrienden');
  assert.equal(raadSoort('Tandarts'), 'overig');
  assert.equal(raadSoort("Borrel met collega's"), 'vrienden', '"collega" is geen "college"');
  assert.equal(raadSoort('Hoorcollege statistiek'), 'school');
});
