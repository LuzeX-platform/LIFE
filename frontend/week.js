import { haalbaarheid, weekBalans, duur, weekdag } from '/planner/index.js';
import { api, esc, koppelUitloggen, status, vandaag, weekVan } from '/api.js';

koppelUitloggen();
const el = id => document.getElementById(id);
const dagenIso = weekVan(vandaag());
const mooi = d => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
el('ondertitel').textContent = `${mooi(dagenIso[0])} tot en met ${mooi(dagenIso[6])}`;

try {
  const [profiel, blokken, checkins] = await Promise.all([
    api('GET', '/api/profiel'), api('GET', `/api/blokken?van=${dagenIso[0]}&tot=${dagenIso[6]}`), api('GET', `/api/checkins?van=${dagenIso[0]}&tot=${dagenIso[6]}`)]);
  const dagen = dagenIso.map(d => ({ datum: d, blokken: blokken.filter(b => b.datum === d) }));
  const doelen = profiel.weekDoelen || {};
  const rijen = Object.keys(doelen).length ? weekBalans(dagen, doelen) : [];
  const MAX = Math.max(1, ...rijen.flatMap(r => [r.gepland, r.doel]));
  el('balans-lijst').innerHTML = rijen.map(r => `<li class="week"><span class="naam">${esc(r.soort.replace('-', ' '))}</span>
    <div class="staaf" role="img" aria-label="${esc(r.soort)}: ${duur(r.gepland)} van ${duur(r.doel)}"><b style="width:${Math.round(100 * r.gepland / MAX)}%"></b><i style="left:${Math.round(100 * r.doel / MAX)}%"></i></div>
    <span class="getal ${r.status === 'achter' ? 'achter' : ''}">${duur(r.gepland)} / ${duur(r.doel)}</span></li>`).join('');
  const achter = rijen.filter(r => r.status === 'achter').map(r => r.soort.replace('-', ' '));
  el('balans-noot').innerHTML = !rijen.length ? 'Je hebt nog geen weekdoelen. <a href="/invullen.html#jij">Stel ze in</a>, dan zie je hier waar je achterloopt.'
    : achter.length ? `Achter op je doel: ${achter.join(', ')}. Het streepje op de balk is het doel.` : 'Alles ligt op koers.';

  const cin = Object.fromEntries(checkins.map(c => [c.datum, c]));
  el('weekdagen').innerHTML = dagen.map(d => {
    const c = cin[d.datum];
    const h = haalbaarheid(d.blokken, { wakkerVan: profiel.wakkerVan, wakkerTot: profiel.wakkerTot, slaapDoel: profiel.slaapDoel, slaapGisteren: c?.slaapMinuten ?? profiel.slaapDoel, energie: c?.energie ?? 3 });
    const leeg = !d.blokken.length;
    return `<li><a class="weekdag-rij" href="/vandaag.html?dag=${d.datum}"><span class="dagnaam">${weekdag(d.datum).slice(0, 2)} ${Number(d.datum.slice(8))}</span>
      <span class="maat ${status(h.oordeel)}" style="margin:0"><b style="width:${leeg ? 0 : h.score}%"></b></span><span class="getal ${status(h.oordeel)}">${leeg ? '–' : h.score}</span></a></li>`;
  }).join('');
} catch (f) { if (f.status !== 401) el('balans-noot').textContent = 'Het laden is niet gelukt. Ververs de pagina.'; }
