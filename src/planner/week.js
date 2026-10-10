import { lengte } from './tijd.js';
import { haalbaarheid } from './haalbaarheid.js';

/**
 * Gepland tegenover het weekdoel per soort, in minuten. "Achter" is minder dan 80% van het
 * doel; gerekend zonder floats (gepland * 5 < doel * 4).
 * @param {import('./typen.js').Dag[]} dagen
 * @param {Record<string, number>} doelen
 */
export function weekBalans(dagen, doelen) {
  return Object.entries(doelen).map(([soort, doel]) => {
    const gepland = dagen.flatMap(d => d.blokken).filter(b => b.soort === soort).reduce((s, b) => s + lengte(b), 0);
    const status = gepland > doel ? 'boven' : gepland * 5 < doel * 4 ? 'achter' : 'op koers';
    return { soort, gepland, doel, status };
  });
}

/** Haalbaarheid per dag van de week, met het profiel van die dag. */
export const weekScores = (dagen, profielVan) =>
  dagen.map(d => ({ datum: d.datum, ...haalbaarheid(d.blokken, profielVan(d)) }));
