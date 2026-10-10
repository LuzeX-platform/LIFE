import test from 'node:test';
import assert from 'node:assert/strict';
import { haalbaarheid, lieverNiet, pasToe, botsingen, weekBalans, bezetteMinuten, klok, duur, minutenVan } from '../src/planner/index.js';
import { week, profiel, weekDoelen } from '../src/voorbeeld/week.js';

const dinsdag = week.find(d => d.datum === '2026-10-13');
const b = (id, start, einde, extra = {}) => ({ id, titel: id, soort: 'overig', start: minutenVan(start), einde: minutenVan(einde), ...extra });
const rustig = { ...profiel, slaapGisteren: 450, energie: 4 };

test('tijd: hele minuten, geen floats', () => {
  assert.equal(klok(450), '07:30');
  assert.equal(duur(340), '5 u 40 min');
  assert.equal(duur(120), '2 u');
  assert.equal(bezetteMinuten([b('a', '08:00', '10:00'), b('b', '09:00', '11:00')]), 180, 'overlap telt één keer');
});

test('haalbaarheid: lege, uitgeslapen dag is 100', () => {
  const r = haalbaarheid([], rustig);
  assert.equal(r.score, 100);
  assert.equal(r.oordeel, 'haalbaar');
});

test('haalbaarheid: slaaptekort kost 5 punten per begonnen halfuur', () => {
  assert.equal(haalbaarheid([], { ...rustig, slaapGisteren: 450 - 30 }).score, 95);
  assert.equal(haalbaarheid([], { ...rustig, slaapGisteren: 450 - 31 }).score, 90);
  assert.equal(haalbaarheid([], { ...rustig, slaapGisteren: 0 }).score, 75, 'maximaal 25 punten');
});

test('haalbaarheid: vulling telt pas vanaf 70% en dubbel boven 85%', () => {
  const wakker = rustig.wakkerTot - rustig.wakkerVan; // 960
  const vul = pct => [b('x', '06:30', klok(rustig.wakkerVan + Math.ceil((wakker * pct) / 100)))];
  assert.equal(haalbaarheid(vul(70), rustig).score, 100);
  assert.equal(haalbaarheid(vul(80), rustig).vulling, 80);
  assert.equal(haalbaarheid(vul(80), rustig).score, 90);
  assert.ok(haalbaarheid(vul(95), rustig).score <= 100 - (15 + 20));
});

test('haalbaarheid: overlap en krappe overgang kosten punten', () => {
  assert.equal(haalbaarheid([b('a', '09:00', '10:00'), b('b', '09:30', '10:30')], rustig).score, 90);
  const krap = [b('a', '09:00', '10:00', { plek: 'x' }), b('b', '10:05', '11:00', { plek: 'y' })];
  assert.equal(haalbaarheid(krap, rustig).score, 97);
  const zelfdePlek = [b('a', '09:00', '10:00', { plek: 'x' }), b('b', '10:05', '11:00', { plek: 'x' })];
  assert.equal(haalbaarheid(zelfdePlek, rustig).score, 100);
});

test('haalbaarheid: score is altijd een geheel getal tussen 0 en 100', () => {
  for (const dag of week) for (const slaap of [0, 200, 340, 450]) for (const energie of [1, 2, 3, 4, 5]) {
    const { score, aftrek } = haalbaarheid(dag.blokken, { ...profiel, slaapGisteren: slaap, energie });
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100);
    for (const a of aftrek) assert.ok(Number.isInteger(a.punten) && a.punten > 0 && a.reden);
  }
});

test('liever niet: vaste blokken en afspraken met mensen komen er nooit in', () => {
  for (const dag of week) for (const slaap of [0, 340, 450]) {
    const { suggesties } = lieverNiet(dag.blokken, { ...profiel, slaapGisteren: slaap, energie: 1 }, { dagen: week, datum: dag.datum });
    for (const s of suggesties) {
      const blok = dag.blokken.find(x => x.id === s.blokId);
      assert.ok(!blok.vast && !blok.persoon, `${blok.titel} mocht niet worden voorgesteld`);
      assert.ok(s.reden && s.alternatief, 'elke suggestie heeft een reden en een alternatief');
    }
  }
});

test('liever niet: dinsdag, kort geslapen, geeft de lichtere training en het uitstelbare werk', () => {
  const r = lieverNiet(dinsdag.blokken, profiel, { dagen: week, datum: dinsdag.datum });
  const soorten = Object.fromEntries(r.suggesties.map(s => [s.blokId, s.soort]));
  assert.equal(soorten['2026-10-13-hardlopen'], 'lichter');
  assert.match(r.suggesties[0].reden, /^Je sliep 5 u 40 min/);
  assert.match(r.suggesties[0].alternatief, /Wandelen, 30 min/);
  assert.ok(r.scoreNa > haalbaarheid(dinsdag.blokken, profiel).score);
});

test('liever niet: een uitgeslapen, rustige dag geeft niets', () => {
  const r = lieverNiet(dinsdag.blokken.filter(x => x.vast), rustig, { dagen: week, datum: dinsdag.datum });
  assert.deepEqual(r.suggesties, []);
});

test('liever niet: stopt zodra de dag haalbaar is, schrapt niet meer dan nodig', () => {
  const vol = [b('w', '07:00', '19:00', { vast: true }), b('u1', '19:00', '20:00', { uitstelbaar: true }), b('u2', '20:00', '21:00', { uitstelbaar: true }), b('u3', '21:00', '22:00', { uitstelbaar: true })];
  const r = lieverNiet(vol, rustig, { dagen: week, datum: '2026-10-13' });
  assert.ok(r.suggesties.length >= 1 && r.suggesties.length < 3);
  assert.ok(r.scoreNa >= 80);
});

test('liever niet: sport wordt niet twee dagen op rij geschrapt zonder dat LIFE het zegt', () => {
  const r = lieverNiet(dinsdag.blokken, profiel, { dagen: week, datum: dinsdag.datum, vorigeDagSportGeschrapt: true });
  assert.ok(!r.suggesties.some(s => s.blokId === '2026-10-13-hardlopen'));
  assert.match(r.opmerkingen[0], /gisteren ook geen sport/);
});

test('liever niet: pasToe geeft de dag zoals hij wordt', () => {
  const r = lieverNiet(dinsdag.blokken, profiel, { dagen: week, datum: dinsdag.datum });
  const na = pasToe(dinsdag.blokken, r.suggesties);
  assert.equal(haalbaarheid(na, profiel).score, r.scoreNa);
  assert.ok(na.some(x => x.id === '2026-10-13-hardlopen' && x.einde - x.start === 30));
});

test('botsingen: voorstel schuift het later beginnende, niet-vaste blok', () => {
  const vrijdag = week.find(d => d.datum === '2026-10-16');
  const [bots] = botsingen(vrijdag.blokken, profiel);
  assert.equal(bots.a.titel, 'Zwemles ophalen');
  assert.equal(bots.voorstel.blokId, '2026-10-16-eten');
  assert.equal(klok(bots.voorstel.start), '19:15');
  assert.equal(bots.voorstel.einde - bots.voorstel.start, 120, 'de duur blijft gelijk');
});

test('botsingen: twee vaste blokken krijgen geen voorstel', () => {
  const [bots] = botsingen([b('a', '09:00', '10:00', { vast: true }), b('b', '09:30', '10:30', { vast: true })], profiel);
  assert.equal(bots.voorstel, null);
});

test('botsingen: geen voorstel dat te laat in de avond uitkomt', () => {
  const [bots] = botsingen([b('a', '20:00', '22:00'), b('b', '21:00', '22:00')], profiel);
  assert.equal(bots.voorstel, null);
});

test('week: balans in minuten, achter onder 80% van het doel', () => {
  const rij = Object.fromEntries(weekBalans(week, weekDoelen).map(r => [r.soort, r]));
  assert.ok(Object.values(rij).every(r => Number.isInteger(r.gepland)));
  assert.equal(weekBalans([{ datum: 'x', blokken: [b('s', '10:00', '11:00', { soort: 'sport' })] }], { sport: 75 })[0].status, 'op koers');
  assert.equal(weekBalans([{ datum: 'x', blokken: [b('s', '10:00', '11:00', { soort: 'sport' })] }], { sport: 76 })[0].status, 'achter');
});
