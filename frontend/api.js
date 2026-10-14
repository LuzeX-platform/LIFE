// Gedeeld door alle pagina's: verzoeken aan de server, datums en het uitloggen.
export async function api(methode, pad, body) {
  const antwoord = await fetch(pad, {
    method: methode, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // De server beslist wie er in mag (autorisatie op de server). Bij een 401 sturen we de bezoeker
  // alleen naar het inlogscherm; de pagina zelf bevat niets dat beschermd hoeft te worden.
  if (antwoord.status === 401 && !pad.startsWith('/api/auth/')) { location.href = '/inloggen.html'; throw new Error('niet ingelogd'); }
  const tekst = await antwoord.text();
  const data = tekst ? JSON.parse(tekst) : null;
  if (!antwoord.ok) throw Object.assign(new Error(data?.errorCode || String(antwoord.status)), { status: antwoord.status, data });
  return data;
}

const twee = n => String(n).padStart(2, '0');
/** De lokale datum als "2026-10-13". Bewust niet via toISOString: dat rekent in UTC en geeft 's avonds de verkeerde dag. */
export const isoDatum = d => `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}`;
export const vandaag = () => isoDatum(new Date());
export const plusDagen = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDatum(d); };
export function maandagVan(iso) { const d = new Date(`${iso}T12:00:00`); const dag = (d.getDay() + 6) % 7; return plusDagen(iso, -dag); }
export const weekVan = iso => { const m = maandagVan(iso); return Array.from({ length: 7 }, (_, i) => plusDagen(m, i)); };

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const status = o => `s-${o.replace(' ', '-')}`;
export const hoofdletter = s => s[0].toUpperCase() + s.slice(1);

/** "6:30", "6u30", "6" of "6.5" niet: alleen hele minuten. Geeft null bij onzin. */
export function leesDuur(tekst) {
  const m = /^\s*(\d{1,2})\s*(?:[:u]\s*(\d{1,2}))?\s*$/.exec(String(tekst).toLowerCase());
  if (!m) return null;
  const min = m[2] === undefined ? 0 : Number(m[2]);
  return min < 60 ? Number(m[1]) * 60 + min : null;
}
export const toonDuur = min => `${Math.floor(min / 60)}:${twee(min % 60)}`;
export const klokNaarMin = t => { const [u, m] = t.split(':').map(Number); return u * 60 + m; };

export function koppelUitloggen() {
  document.addEventListener('click', async e => {
    if (!e.target.closest('#uitloggen')) return;
    await fetch('/api/auth/uitloggen', { method: 'POST', credentials: 'same-origin' });
    location.href = '/inloggen.html';
  });
}

export const FOUTEN = {
  INLOG_ONJUIST: 'Dit e-mailadres of wachtwoord klopt niet.',
  EMAIL_BESTAAT: 'Er is al een account met dit e-mailadres.',
  ONGELDIGE_INVOER: 'Controleer je invoer en probeer het opnieuw.',
  TOESTEMMING_ONTBREEKT: 'Geef eerst toestemming om slaap en energie te bewaren.',
  WACHTWOORD_ONJUIST: 'Dat wachtwoord klopt niet.',
  WEEK_NIET_LEEG: 'In deze week staat al iets. De voorbeeldweek vult alleen een lege week.',
  TE_VEEL_VERZOEKEN: 'Te veel pogingen. Wacht een minuut en probeer het opnieuw.',
};
export const foutTekst = e => FOUTEN[e?.message] || 'Er ging iets mis. Probeer het opnieuw.';
