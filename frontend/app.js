// Gedeeld door de pagina's: kop met navigatie, en kleine hulpjes.
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const statusKlasse = oordeel => `s-${oordeel.replace(' ', '-')}`;

export function kop(actief) {
  const link = (href, tekst, id) => `<a href="${href}"${id === actief ? ' aria-current="page"' : ''}>${tekst}</a>`;
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="kop"><div class="kop-binnen">
      <span class="merk">LIFE</span><span class="chip">Prototype</span>
      <nav aria-label="Hoofdmenu">${link('/vandaag.html', 'Vandaag', 'vandaag')}${link('/week.html', 'Week', 'week')}</nav>
    </div></header>`);
}
