import { klok, opTijd } from './tijd.js';

const STAP = 15; // voorstellen schuiven in kwartieren; 19:07 zegt niemand

/**
 * Overlappende blokken, met waar mogelijk een voorstel. Alleen het later beginnende blok wordt
 * verschoven, en alleen als dat niet vast staat. Is er geen veilige oplossing, dan komt er geen
 * voorstel en moet de gebruiker kiezen: een slecht voorstel is erger dan geen.
 * @param {import('./typen.js').Blok[]} blokken
 * @param {import('./typen.js').Profiel} profiel
 */
export function botsingen(blokken, profiel) {
  const gesorteerd = opTijd(blokken), uit = [];
  for (let i = 0; i < gesorteerd.length - 1; i++) {
    const a = gesorteerd[i], b = gesorteerd[i + 1];
    if (b.start >= a.einde) continue;
    const botsing = { a, b, voorstel: null };
    if (!b.vast) {
      const nodig = a.einde + (a.reisNa || 0) - b.start;
      const schuif = Math.ceil(nodig / STAP) * STAP, start = b.start + schuif, einde = b.einde + schuif;
      const past = einde <= profiel.wakkerTot - 60 &&
        !blokken.some(x => x.id !== b.id && x.id !== a.id && x.start < einde && start < x.einde);
      if (past) botsing.voorstel = { blokId: b.id, start, einde, tekst: `Schuif ${b.titel} naar ${klok(start)}.` };
    }
    uit.push(botsing);
  }
  return uit;
}
