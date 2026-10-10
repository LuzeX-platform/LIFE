// Verzonnen voorbeeldweek voor het prototype en de tests. Geen echte gegevens.
import { minutenVan as t } from '../planner/tijd.js';

const b = (id, titel, soort, van, tot, extra = {}) => ({ id, titel, soort, start: t(van), einde: t(tot), ...extra });

export const profiel = { wakkerVan: t('06:30'), wakkerTot: t('22:30'), slaapDoel: 450, slaapGisteren: 340, energie: 3 };

export const weekDoelen = { werk: 2400, gezin: 1500, sport: 360, vrienden: 240, school: 240, 'vrije-tijd': 360 };

const werkdag = (datum, extra = [], werkEinde = '16:30') => ({
  datum,
  blokken: [
    b(`${datum}-kind`, 'Kinderen naar school', 'gezin', '07:30', '08:00', { vast: true, plek: 'school' }),
    b(`${datum}-reis1`, 'Reistijd naar werk', 'reis', '08:00', '08:45', { vast: true }),
    b(`${datum}-werk1`, 'Werk', 'werk', '08:45', '12:00', { vast: true, plek: 'werk' }),
    b(`${datum}-lunch`, 'Lunch', 'vrije-tijd', '12:00', '12:30', { vast: true, plek: 'werk' }),
    b(`${datum}-werk2`, 'Werk', 'werk', '12:30', werkEinde, { vast: true, plek: 'werk' }),
    b(`${datum}-reis2`, 'Reistijd naar huis', 'reis', '17:00', '17:30', { vast: true }),
    b(`${datum}-eten`, 'Koken en samen eten', 'gezin', '17:45', '18:45', { vast: true, plek: 'thuis' }),
    ...extra,
  ],
});

export const week = [
  werkdag('2026-10-12', [b('2026-10-12-sport', 'Krachttraining', 'sport', '19:30', '20:30', { zwaar: true, plek: 'sportschool', lichter: { titel: 'Rustige wandeling', duur: 30 } })]),
  // Dinsdag: een kort geslapen nacht, een zware training, een oudergesprek en extra werk.
  werkdag('2026-10-13', [
    b('2026-10-13-extra', 'Extra uur werken', 'werk', '15:30', '16:30', { uitstelbaar: true, plek: 'werk' }),
    b('2026-10-13-hardlopen', 'Hardlopen, 10 km', 'sport', '18:55', '19:55', { zwaar: true, plek: 'buiten', lichter: { titel: 'Wandelen', duur: 30 } }),
    b('2026-10-13-oudergesprek', 'Oudergesprek', 'school', '20:15', '21:00', { vast: true, persoon: true, plek: 'school' }),
    b('2026-10-13-boodschappen', 'Boodschappen', 'overig', '21:10', '21:50', { uitstelbaar: true, plek: 'winkel' }),
  ], '15:30'),
  werkdag('2026-10-14'),
  werkdag('2026-10-15', [b('2026-10-15-vrienden', 'Borrel met collega\'s', 'vrienden', '18:45', '20:15', { persoon: true, plek: 'café' })]),
  {
    datum: '2026-10-16',
    blokken: [
      b('2026-10-16-kind', 'Kinderen naar school', 'gezin', '07:30', '08:00', { vast: true, plek: 'school' }),
      b('2026-10-16-werk', 'Werk', 'werk', '08:45', '14:00', { vast: true, plek: 'werk' }),
      b('2026-10-16-zwem', 'Zwemles ophalen', 'gezin', '18:30', '19:15', { vast: true, plek: 'zwembad' }),
      b('2026-10-16-eten', 'Eten met Sanne', 'vrienden', '19:00', '21:00', { persoon: true, plek: 'restaurant', reisNa: 0 }),
    ],
  },
  { datum: '2026-10-17', blokken: [b('2026-10-17-sport', 'Lange wandeling', 'sport', '10:00', '12:00', { plek: 'buiten' }), b('2026-10-17-gezin', 'Dagje weg met het gezin', 'gezin', '13:00', '17:00', { vast: true })] },
  { datum: '2026-10-18', blokken: [b('2026-10-18-vrij', 'Vrije middag', 'vrije-tijd', '14:00', '17:00')] },
];
