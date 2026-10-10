import { haalbaarheid, weekBalans, duur, weekdag } from '/planner/index.js';
import { week, profiel, weekDoelen } from '/voorbeeld/week.js';

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const status = o => `s-${o.replace(' ', '-')}`;

const balans = weekBalans(week, weekDoelen);
const MAX = Math.max(...balans.flatMap(r => [r.gepland, r.doel]));
el('balans-lijst').innerHTML = balans.map(r => `<li class="week"><span class="naam">${esc(r.soort.replace('-', ' '))}</span>
  <div class="staaf" role="img" aria-label="${esc(r.soort)}: ${duur(r.gepland)} van ${duur(r.doel)}"><b style="width:${Math.round(100 * r.gepland / MAX)}%"></b><i style="left:${Math.round(100 * r.doel / MAX)}%"></i></div>
  <span class="getal ${r.status === 'achter' ? 'achter' : ''}">${duur(r.gepland)} / ${duur(r.doel)}</span></li>`).join('');
const achter = balans.filter(r => r.status === 'achter').map(r => r.soort.replace('-', ' '));
el('balans-noot').textContent = achter.length ? `Achter op je doel: ${achter.join(', ')}. Het streepje op de balk is het doel.` : 'Alles ligt op koers.';

// Alleen dinsdag heeft in het voorbeeld een kort geslapen nacht; de rest staat op het doel.
el('weekdagen').innerHTML = week.map(d => {
  const h = haalbaarheid(d.blokken, d.datum === '2026-10-13' ? profiel : { ...profiel, slaapGisteren: profiel.slaapDoel });
  return `<li class="weekdag-rij"><a href="/vandaag.html">${weekdag(d.datum).slice(0, 2)} ${Number(d.datum.slice(8))}</a>
    <div class="maat ${status(h.oordeel)}" style="margin:0" role="img" aria-label="${h.score} van 100"><b style="width:${h.score}%"></b></div>
    <span class="getal ${status(h.oordeel)}">${h.score}</span></li>`;
}).join('');
