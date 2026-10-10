import { haalbaarheid, weekBalans, duur, weekdag } from '/planner/index.js';
import { week, profiel, weekDoelen } from '/voorbeeld/week.js';
import { esc, kop, statusKlasse } from '/app.js';

kop('week');
const el = id => document.getElementById(id);
el('ondertitel').textContent = '12 tot en met 18 oktober';

const balans = weekBalans(week, weekDoelen);
const MAX = Math.max(...balans.flatMap(r => [r.gepland, r.doel]));
el('balans').innerHTML = balans.map(r => `<li><span class="naam">${esc(r.soort.replace('-', ' '))}</span>
  <div class="staaf" role="img" aria-label="${esc(r.soort)}: ${duur(r.gepland)} van ${duur(r.doel)}"><b style="width:${Math.round(100 * r.gepland / MAX)}%"></b><i style="left:${Math.round(100 * r.doel / MAX)}%"></i></div>
  <span class="getal ${r.status === 'achter' ? 'achter' : ''}">${duur(r.gepland)} / ${duur(r.doel)}</span></li>`).join('');

// Alleen dinsdag heeft in het voorbeeld een kort geslapen nacht; de rest staat op het doel.
el('weekdagen').innerHTML = week.map(d => {
  const p = d.datum === '2026-10-13' ? profiel : { ...profiel, slaapGisteren: profiel.slaapDoel };
  const h = haalbaarheid(d.blokken, p);
  return `<li><a href="/vandaag.html">${weekdag(d.datum).slice(0, 2)} ${Number(d.datum.slice(8))}</a>
    <div class="meter ${statusKlasse(h.oordeel)}" style="margin:0" role="img" aria-label="${h.score} van 100"><b style="width:${h.score}%"></b></div>
    <span class="getal num ${statusKlasse(h.oordeel)}">${h.score}</span></li>`;
}).join('');
