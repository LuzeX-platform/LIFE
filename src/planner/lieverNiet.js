import { haalbaarheid, REGELS, vullingProcent } from './haalbaarheid.js';
import { duur, lengte, weekdag } from './tijd.js';

const WENSEN = ['sport', 'vrienden', 'vrije-tijd'];

/**
 * Wat er vandaag beter uit kan, in vaste volgorde en met een reden. LIFE stelt voor, de
 * gebruiker beslist. Een vaste afspraak of een afspraak met een persoon komt hier nooit in.
 *
 * Volgorde: (1) gezondheid: een zwaar blok bij slaaptekort of lage energie wordt lichter,
 * altijd; (2) wat zonder gevolgen kan wachten; (3) wensen die later in de week nog passen.
 * Stap 2 en 3 stoppen zodra de dag weer haalbaar is, zodat LIFE niet meer schrapt dan nodig.
 * Overwogen en afgevallen: eerst de langste blokken schrappen. Dat haalt sneller punten weg,
 * maar schrapt dan sport voor een boodschap.
 *
 * @param {import('./typen.js').Blok[]} blokken
 * @param {import('./typen.js').Profiel} profiel
 * @param {{ dagen?: import('./typen.js').Dag[], datum?: string, vorigeDagSportGeschrapt?: boolean }} [week]
 */
export function lieverNiet(blokken, profiel, week = {}) {
  const suggesties = [], opmerkingen = [];
  const tekort = Math.max(0, profiel.slaapDoel - profiel.slaapGisteren);
  const moe = tekort >= 60 || profiel.energie <= 2;
  let huidig = blokken.slice();
  const vullingNu = vullingProcent(blokken, profiel); // de reden hoort bij de dag zoals hij is, niet bij de dag na eerdere voorstellen
  const kandidaten = () => huidig.filter(b => !b.vast && !b.persoon && !suggesties.some(s => s.blokId === b.id));

  // De eerstvolgende dag na vandaag met ruimte, voor "zet het op ...".
  const ruimteOp = (week.dagen || []).find(d => d.datum > (week.datum || '') &&
    vullingProcent(d.blokken, profiel) < REGELS.vullingStart);
  const wanneer = ruimteOp ? weekdag(ruimteOp.datum) : null;

  // 1. Gezondheid.
  if (moe) {
    for (const b of kandidaten().filter(x => x.zwaar)) {
      if (b.soort === 'sport' && week.vorigeDagSportGeschrapt) {
        opmerkingen.push(`Je hebt gisteren ook geen sport gedaan. LIFE laat ${b.titel} staan; kies zelf of je het lichter doet.`);
        continue;
      }
      const redenen = [];
      if (tekort >= 60) redenen.push(`je sliep ${duur(profiel.slaapGisteren)}`);
      if (profiel.energie <= 2) redenen.push(`je energie is ${profiel.energie} van 5`);
      suggesties.push({
        blokId: b.id, soort: 'lichter', titel: b.titel,
        reden: `${redenen[0][0].toUpperCase()}${redenen.join(' en ').slice(1)}.`,
        alternatief: b.lichter ? `${b.lichter.titel}, ${duur(b.lichter.duur)}.` : 'Doe het rustiger.',
        vervanging: b.lichter ? { titel: b.lichter.titel, einde: b.start + b.lichter.duur, zwaar: false } : null,
      });
    }
    huidig = pasToe(blokken, suggesties);
  }

  // 2 en 3. Alleen zolang de dag nog niet haalbaar is.
  const nodig = () => haalbaarheid(huidig, profiel).score < REGELS.haalbaarVanaf;
  const wachten = kandidaten().filter(b => b.uitstelbaar).sort((a, b) => lengte(b) - lengte(a));
  const wensen = kandidaten().filter(b => !b.uitstelbaar && WENSEN.includes(b.soort)).sort((a, b) => lengte(b) - lengte(a));
  for (const b of [...wachten, ...wensen]) {
    if (!nodig()) break;
    const uitstel = b.uitstelbaar;
    if (!uitstel && !wanneer) continue; // een wens schrappen zonder dat er later ruimte is, doet LIFE niet
    if (!uitstel && b.soort === 'sport' && week.vorigeDagSportGeschrapt) {
      opmerkingen.push(`Je hebt gisteren ook geen sport gedaan. LIFE laat ${b.titel} staan.`);
      continue;
    }
    suggesties.push({
      blokId: b.id, soort: wanneer ? 'verplaatsen' : 'laten liggen', titel: b.titel,
      reden: `Je dag is voor ${vullingNu}% gevuld.`,
      alternatief: wanneer ? `Zet het op ${wanneer}, daar is ruimte.` : 'Laat het vandaag liggen.',
      vervanging: null,
    });
    huidig = pasToe(blokken, suggesties);
  }

  return { suggesties, opmerkingen, scoreNa: haalbaarheid(huidig, profiel).score };
}

/** De dag zoals hij wordt als alle suggesties worden toegepast. */
export function pasToe(blokken, suggesties) {
  const per = new Map(suggesties.map(s => [s.blokId, s]));
  return blokken.flatMap(b => {
    const s = per.get(b.id);
    if (!s) return [b];
    return s.vervanging ? [{ ...b, ...s.vervanging }] : [];
  });
}
