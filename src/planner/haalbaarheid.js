import { bezetteMinuten, duur, lengte, opTijd } from './tijd.js';

// Alle drempels staan hier bij elkaar en zijn de eerste waarden uit docs/planregels.md. Ze zijn
// bewust nog niet gekalibreerd met echte dagen; pas ze aan op één plek, de tests laten zien wat
// er verschuift.
export const REGELS = {
  vullingStart: 70,      // vanaf hier gaat de dag punten kosten
  vullingStreng: 85,     // boven dit percentage telt elk procent dubbel
  vullingMax: 40,
  slaapPerHalfuur: 5,
  slaapMax: 25,
  overgangMinuten: 10,   // korter dan dit tussen twee plekken is te krap
  overgangPunten: 3,
  overgangMax: 15,
  overlapPunten: 10,
  overlapMax: 20,
  zwaarNaMinuten: 480,   // zoveel werk of school erboven: een zwaar blok erachter weegt extra
  zwaarPunten: 8,
  zwaarMax: 16,
  haalbaarVanaf: 80,
  krapVanaf: 60,
};

/** Het percentage van de wakkere minuten dat gepland is, naar beneden afgerond. */
export function vullingProcent(blokken, profiel) {
  const wakker = profiel.wakkerTot - profiel.wakkerVan;
  return Math.floor((100 * bezetteMinuten(blokken)) / wakker);
}

/**
 * Haalbaarheid van één dag, 0 tot 100. Elk strafpunt komt met een reden terug, want de reden
 * is het product: de gebruiker moet het cijfer kunnen nalezen.
 * @returns {{score:number, oordeel:'haalbaar'|'krap'|'te vol', vulling:number, vrij:number, aftrek:{soort:string,punten:number,reden:string}[]}}
 */
export function haalbaarheid(blokken, profiel) {
  const R = REGELS, aftrek = [];
  const wakker = profiel.wakkerTot - profiel.wakkerVan;
  const bezet = bezetteMinuten(blokken);
  const vulling = Math.floor((100 * bezet) / wakker);

  if (vulling > R.vullingStart) {
    const punten = Math.min(R.vullingMax,
      Math.min(vulling, R.vullingStreng) - R.vullingStart + Math.max(0, vulling - R.vullingStreng) * 2);
    aftrek.push({ soort: 'vulling', punten, reden: `Je dag is voor ${vulling}% gevuld.` });
  }

  const tekort = Math.max(0, profiel.slaapDoel - profiel.slaapGisteren);
  if (tekort > 0) {
    const punten = Math.min(R.slaapMax, R.slaapPerHalfuur * Math.ceil(tekort / 30));
    aftrek.push({ soort: 'slaap', punten, reden: `Je sliep ${duur(profiel.slaapGisteren)}, ${duur(tekort)} minder dan je doel.` });
  }

  if (profiel.energie <= 2) {
    aftrek.push({ soort: 'energie', punten: profiel.energie === 1 ? 10 : 5, reden: `Je energie is ${profiel.energie} van 5.` });
  }

  const gesorteerd = opTijd(blokken);
  let overgang = 0, overlap = 0;
  for (let i = 0; i < gesorteerd.length - 1; i++) {
    const a = gesorteerd[i], b = gesorteerd[i + 1], gat = b.start - a.einde;
    if (gat < 0) overlap += R.overlapPunten;
    else if (a.plek && b.plek && a.plek !== b.plek && gat < R.overgangMinuten) overgang += R.overgangPunten;
  }
  if (overlap) aftrek.push({ soort: 'overlap', punten: Math.min(R.overlapMax, overlap), reden: 'Twee blokken overlappen.' });
  if (overgang) aftrek.push({ soort: 'overgang', punten: Math.min(R.overgangMax, overgang), reden: `Minder dan ${R.overgangMinuten} minuten tussen twee plekken.` });

  let zwaar = 0;
  for (const b of gesorteerd) {
    if (!b.zwaar) continue;
    const eerder = gesorteerd.filter(x => (x.soort === 'werk' || x.soort === 'school') && x.einde <= b.start)
      .reduce((s, x) => s + lengte(x), 0);
    if (eerder >= R.zwaarNaMinuten) zwaar += R.zwaarPunten;
  }
  if (zwaar) aftrek.push({ soort: 'zwaar', punten: Math.min(R.zwaarMax, zwaar), reden: `Een zwaar blok na ${duur(R.zwaarNaMinuten)} of meer werk.` });

  const score = Math.max(0, 100 - aftrek.reduce((s, a) => s + a.punten, 0));
  const oordeel = score >= R.haalbaarVanaf ? 'haalbaar' : score >= R.krapVanaf ? 'krap' : 'te vol';
  return { score, oordeel, vulling, vrij: wakker - bezet, aftrek };
}
