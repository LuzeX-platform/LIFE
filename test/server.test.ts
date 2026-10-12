// Integratietests tegen een echte PostgreSQL. Alleen als TEST_DATABASE_URL gezet is, zodat
// `npm test` zonder database blijft werken. Zie de README voor het opzetten van een testdatabase.
import test from "node:test";
import assert from "node:assert/strict";

const URL_DB = process.env.TEST_DATABASE_URL;
const opts = { skip: URL_DB ? false : "TEST_DATABASE_URL niet gezet" };

if (URL_DB) {
  process.env.DATABASE_URL = URL_DB;
  process.env.JWT_SECRET = "test-geheim-test-geheim-test-geheim-1234";
}

const { bouwApp } = URL_DB ? await import("../src/server/app.js") : ({} as any);
const { db } = URL_DB ? await import("../src/server/db.js") : ({} as any);
const WW = "een-lang-wachtwoord-123";
let app: any;

test.before(async () => { if (URL_DB) { app = await bouwApp({ logger: false }); await db.gebruiker.deleteMany(); } }, opts);
test.after(async () => { if (URL_DB) { await app.close(); await db.$disconnect(); } }, opts);

const cookieUit = (r: any) => { const c = r.cookies.find((x: any) => x.name === "life_sessie"); return c ? `life_sessie=${c.value}` : ""; };
// Elke test-gebruiker krijgt een eigen IP, anders raakt de begrenzing van 10 registraties per minuut op.
let ipTeller = 0;
async function maakGebruiker(email: string, toestemming = true) {
  const r = await app.inject({ method: "POST", url: "/api/auth/registreren", remoteAddress: `10.0.0.${++ipTeller}`, payload: { email, wachtwoord: WW, toestemmingGezondheid: toestemming } });
  assert.equal(r.statusCode, 201);
  return cookieUit(r);
}
const api = (cookie: string, method: string, url: string, payload?: unknown) => app.inject({ method, url, payload: payload as any, headers: { cookie } });
const blok = { datum: "2026-10-13", titel: "Hardlopen", soort: "sport", start: 1110, einde: 1170, zwaar: true };

test("gezondheid: database bereikbaar", opts, async () => {
  assert.equal((await app.inject({ url: "/api/gezondheid" })).statusCode, 200);
});

test("zonder inloggen geeft elke gegevensroute 401", opts, async () => {
  for (const [m, u] of [["GET", "/api/profiel"], ["GET", "/api/blokken?van=2026-10-12&tot=2026-10-18"], ["POST", "/api/blokken"], ["GET", "/api/checkins?van=2026-10-12&tot=2026-10-18"], ["GET", "/api/account/export"], ["POST", "/api/voorbeeld"]]) {
    assert.equal((await app.inject({ method: m as any, url: u })).statusCode, 401, `${m} ${u}`);
  }
});

test("registreren: kort wachtwoord en dubbel adres worden geweigerd", opts, async () => {
  const kort = await app.inject({ method: "POST", url: "/api/auth/registreren", remoteAddress: "10.0.1.2", payload: { email: "kort@voorbeeld.nl", wachtwoord: "kort" } });
  assert.equal(kort.statusCode, 400);
  await maakGebruiker("dubbel@voorbeeld.nl");
  const dubbel = await app.inject({ method: "POST", url: "/api/auth/registreren", remoteAddress: "10.0.1.1", payload: { email: "DUBBEL@voorbeeld.nl", wachtwoord: WW } });
  assert.equal(dubbel.statusCode, 409, "hoofdletters tellen niet als ander adres");
});

test("inloggen: zelfde melding voor onbekend adres en fout wachtwoord; wachtwoord staat gehasht", opts, async () => {
  await maakGebruiker("inlog@voorbeeld.nl");
  const fout = await app.inject({ method: "POST", url: "/api/auth/inloggen", remoteAddress: "10.0.1.3", payload: { email: "inlog@voorbeeld.nl", wachtwoord: "verkeerd-wachtwoord-1" } });
  const onbekend = await app.inject({ method: "POST", url: "/api/auth/inloggen", remoteAddress: "10.0.1.3", payload: { email: "niemand@voorbeeld.nl", wachtwoord: "verkeerd-wachtwoord-1" } });
  assert.equal(fout.statusCode, 401); assert.equal(onbekend.statusCode, 401);
  assert.deepEqual(fout.json(), onbekend.json());
  const goed = await app.inject({ method: "POST", url: "/api/auth/inloggen", remoteAddress: "10.0.1.3", payload: { email: "inlog@voorbeeld.nl", wachtwoord: WW } });
  assert.equal(goed.statusCode, 200);
  const c = goed.cookies.find((x: any) => x.name === "life_sessie");
  assert.ok(c.httpOnly && c.sameSite === "Strict");
  const g = await db.gebruiker.findUnique({ where: { email: "inlog@voorbeeld.nl" } });
  assert.match(g.wachtwoordHash, /^\$argon2id\$/);
});

test("blokken: aanmaken, lezen, wijzigen en schrappen (nooit echt verwijderen)", opts, async () => {
  const c = await maakGebruiker("blokken@voorbeeld.nl");
  const nieuw = await api(c, "POST", "/api/blokken", blok);
  assert.equal(nieuw.statusCode, 201);
  const id = nieuw.json().id;
  const lijst = (await api(c, "GET", "/api/blokken?van=2026-10-12&tot=2026-10-18")).json();
  assert.equal(lijst.length, 1); assert.equal(lijst[0].zwaar, true);
  assert.equal((await api(c, "PATCH", `/api/blokken/${id}`, { status: "gedaan" })).json().status, "gedaan");
  assert.equal((await api(c, "PATCH", `/api/blokken/${id}`, { start: 1200 })).statusCode, 400, "start mag niet na het einde komen");
  await api(c, "PATCH", `/api/blokken/${id}`, { status: "geschrapt" });
  assert.equal((await api(c, "GET", "/api/blokken?van=2026-10-12&tot=2026-10-18")).json().length, 0);
  assert.ok(await db.blok.findUnique({ where: { id } }), "het blok bestaat nog in de database");
});

test("blokken: einde voor start en onbekende velden worden geweigerd", opts, async () => {
  const c = await maakGebruiker("invoer@voorbeeld.nl");
  assert.equal((await api(c, "POST", "/api/blokken", { ...blok, einde: 1000 })).statusCode, 400);
  assert.equal((await api(c, "POST", "/api/blokken", { ...blok, soort: "onzin" })).statusCode, 400);
  assert.equal((await api(c, "POST", "/api/blokken", { ...blok, datum: "13-10-2026" })).statusCode, 400);
  const id = (await api(c, "POST", "/api/blokken", blok)).json().id;
  assert.equal((await api(c, "PATCH", `/api/blokken/${id}`, { gebruikerId: "x" })).statusCode, 400, "gebruikerId is niet te wijzigen");
});

test("gebruikers zien en wijzigen elkaars gegevens niet", opts, async () => {
  const a = await maakGebruiker("a@voorbeeld.nl"), b = await maakGebruiker("b@voorbeeld.nl");
  const id = (await api(a, "POST", "/api/blokken", blok)).json().id;
  assert.equal((await api(b, "GET", "/api/blokken?van=2026-10-12&tot=2026-10-18")).json().length, 0);
  assert.equal((await api(b, "PATCH", `/api/blokken/${id}`, { status: "geschrapt" })).statusCode, 404);
  assert.equal((await db.blok.findUnique({ where: { id } })).status, "gepland");
});

test("check-in: zonder toestemming 403, met toestemming opgeslagen, intrekken wist ze", opts, async () => {
  const zonder = await maakGebruiker("zonder@voorbeeld.nl", false);
  assert.equal((await api(zonder, "PUT", "/api/checkins/2026-10-13", { slaapMinuten: 340, energie: 3 })).json().errorCode, "TOESTEMMING_ONTBREEKT");
  const met = await maakGebruiker("met@voorbeeld.nl", true);
  assert.equal((await api(met, "PUT", "/api/checkins/2026-10-13", { slaapMinuten: 340, energie: 3 })).statusCode, 200);
  assert.equal((await api(met, "PUT", "/api/checkins/2026-10-13", { slaapMinuten: 400, energie: 4 })).json().slaapMinuten, 400, "tweede keer overschrijft");
  assert.equal((await api(met, "PUT", "/api/checkins/2026-10-13", { slaapMinuten: 400, energie: 6 })).statusCode, 400);
  await api(met, "POST", "/api/account/toestemming", { gegeven: false });
  assert.equal((await api(met, "GET", "/api/checkins?van=2026-10-12&tot=2026-10-18")).json().length, 0);
});

test("profiel: standaardwaarden, opslaan en ongeldige invoer", opts, async () => {
  const c = await maakGebruiker("profiel@voorbeeld.nl");
  const p = (await api(c, "GET", "/api/profiel")).json();
  assert.equal(p.slaapDoel, 450);
  const nieuw = { wakkerVan: 360, wakkerTot: 1380, slaapDoel: 480, weekDoelen: { sport: 360, vrienden: 240 } };
  assert.equal((await api(c, "PUT", "/api/profiel", nieuw)).statusCode, 200);
  assert.equal((await api(c, "GET", "/api/profiel")).json().weekDoelen.sport, 360);
  assert.equal((await api(c, "PUT", "/api/profiel", { ...nieuw, wakkerTot: 400 })).statusCode, 400, "wakkere dag minstens 8 uur");
  assert.equal((await api(c, "PUT", "/api/profiel", { ...nieuw, weekDoelen: { onzin: 5 } })).statusCode, 400);
});

test("voorbeeldweek vult een lege week, en overschrijft nooit", opts, async () => {
  const c = await maakGebruiker("voorbeeld@voorbeeld.nl");
  const r = await api(c, "POST", "/api/voorbeeld", { maandag: "2026-11-02" });
  assert.equal(r.statusCode, 201); assert.ok(r.json().aantal > 20);
  assert.equal((await api(c, "POST", "/api/voorbeeld", { maandag: "2026-11-02" })).statusCode, 409);
  const lijst = (await api(c, "GET", "/api/blokken?van=2026-11-02&tot=2026-11-08")).json();
  assert.ok(lijst.some((b: any) => b.datum === "2026-11-03" && b.titel === "Hardlopen, 10 km"));
});

test("export bevat alles; verwijderen vraagt het wachtwoord en wist alles", opts, async () => {
  const c = await maakGebruiker("weg@voorbeeld.nl");
  await api(c, "POST", "/api/blokken", blok);
  await api(c, "PUT", "/api/checkins/2026-10-13", { slaapMinuten: 340, energie: 3 });
  const ex = (await api(c, "GET", "/api/account/export")).json();
  assert.equal(ex.blokken.length, 1); assert.equal(ex.checkins.length, 1); assert.equal(ex.wachtwoordHash, undefined, "de hash zit niet in de export");
  assert.equal((await api(c, "POST", "/api/account/verwijderen", { wachtwoord: "fout" })).statusCode, 403);
  assert.equal((await api(c, "POST", "/api/account/verwijderen", { wachtwoord: WW })).statusCode, 200);
  const g = await db.gebruiker.findUnique({ where: { email: "weg@voorbeeld.nl" } });
  assert.equal(g, null);
  assert.equal(await db.blok.count({ where: { titel: "Hardlopen", gebruikerId: ex.blokken[0].gebruikerId } }), 0, "ook de agenda is weg");
  assert.equal((await api(c, "GET", "/api/profiel")).statusCode, 401, "de oude sessie werkt niet meer");
});

test("schrijvende verzoeken vanaf een andere oorsprong worden geweigerd", opts, async () => {
  const r = await app.inject({ method: "POST", url: "/api/auth/inloggen", headers: { origin: "https://kwaadaardig.example", host: "life.test" }, payload: { email: "x@y.nl", wachtwoord: "x" } });
  assert.equal(r.statusCode, 403);
});

test("inloggen is begrensd tot 10 pogingen per minuut", opts, async () => {
  let laatste = 0;
  for (let i = 0; i < 12; i++) laatste = (await app.inject({ method: "POST", url: "/api/auth/inloggen", remoteAddress: "10.9.9.9", payload: { email: "geen@voorbeeld.nl", wachtwoord: "x" } })).statusCode;
  assert.equal(laatste, 429);
});
