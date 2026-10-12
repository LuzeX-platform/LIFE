import { api, foutTekst } from '/api.js';

const el = id => document.getElementById(id);
let modus = 'inloggen';

// Al ingelogd? Dan direct door naar je dag.
api('GET', '/api/auth/ik').then(() => { location.href = '/vandaag.html'; }).catch(() => {});

function zet(m) {
  modus = m;
  el('titel-form').textContent = m === 'inloggen' ? 'Inloggen' : 'Account maken';
  el('registratie-velden').hidden = m === 'inloggen';
  el('knop').textContent = m === 'inloggen' ? 'Inloggen' : 'Account maken';
  el('wissel').textContent = m === 'inloggen' ? 'Nog geen account? Maak er een.' : 'Heb je al een account? Log in.';
  el('wachtwoord').autocomplete = m === 'inloggen' ? 'current-password' : 'new-password';
  el('form-melding').textContent = '';
}
el('wissel').addEventListener('click', () => zet(modus === 'inloggen' ? 'registreren' : 'inloggen'));

el('formulier').addEventListener('submit', async e => {
  e.preventDefault();
  const melding = el('form-melding'), knop = el('knop');
  melding.textContent = '';
  const email = el('email').value, wachtwoord = el('wachtwoord').value;
  if (modus === 'registreren' && wachtwoord.length < 12) { melding.textContent = 'Kies een wachtwoord van minstens 12 tekens.'; el('wachtwoord').focus(); return; }
  knop.disabled = true;
  try {
    await api('POST', `/api/auth/${modus}`, modus === 'inloggen' ? { email, wachtwoord } : { email, wachtwoord, toestemmingGezondheid: el('toestemming').checked });
    // Wie net een account heeft, begint bij het invullen; wie terugkomt, bij zijn dag.
    location.href = modus === 'registreren' ? '/invullen.html' : '/vandaag.html';
  } catch (fout) {
    melding.textContent = foutTekst(fout);
    knop.disabled = false;
  }
});
zet('inloggen');
