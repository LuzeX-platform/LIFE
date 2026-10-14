// Tijd en duur in hele minuten sinds middernacht. Nooit floats: 90 minuten is 90, geen 1,5 uur.

/** @param {number} u @param {number} [m] */
export const uur = (u, m = 0) => u * 60 + m;

/** "07:30" -> 450 */
export function minutenVan(klokTekst) {
  const [u, m] = klokTekst.split(':').map(Number);
  return u * 60 + m;
}

/** 450 -> "07:30" */
export function klok(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** 340 -> "5 u 40 min" */
export function duur(min) {
  const u = Math.floor(min / 60), m = min % 60;
  if (!u) return `${m} min`;
  return m ? `${u} u ${m} min` : `${u} u`;
}

export const lengte = blok => blok.einde - blok.start;

/** Aantal minuten dat door minstens één blok bezet is; overlap telt maar één keer. */
export function bezetteMinuten(blokken) {
  const lijst = blokken.map(b => [b.start, b.einde]).sort((a, b) => a[0] - b[0]);
  let totaal = 0, tot = -Infinity;
  for (const [van, naar] of lijst) {
    if (naar <= tot) continue;
    totaal += naar - Math.max(van, tot);
    tot = naar;
  }
  return totaal;
}

export const opTijd = blokken => blokken.slice().sort((a, b) => a.start - b.start || a.einde - b.einde);

/** "2026-10-13" -> "dinsdag". Via UTC, zodat de tijdzone van de browser niets verschuift. */
export function weekdag(datum) {
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${datum}T12:00:00Z`));
}
