# LIFE

Eén app die je werk, sport, gezin en vrije tijd op elkaar afstemt. Je ziet niet alleen wat je
moet doen, maar ook wat je vandaag beter níét kunt doen. Elke ochtend een dagplan dat je echt
kunt halen.

Onderdeel van het LuzeX-platform; zie de hub voor hoe de projecten samenhangen.

## Stand van zaken

Planlogica en een klikbaar dashboard-prototype met voorbeeldgegevens. Er is nog geen backend,
geen database en geen inloggen.

```bash
npm test      # de planregels, 16 tests, geen afhankelijkheden
npm run dev   # prototype op http://localhost:5173 (Vandaag en Week)
```

- [`docs/planregels.md`](docs/planregels.md): hoe LIFE rekent, en de gemaakte keuzes.
- `src/planner/`: de planlogica. Gewone ES-modules in JavaScript met JSDoc-types, zodat
  dezelfde code in de tests én in de browser draait zonder build-stap. (Afwijking van
  "TypeScript" in de rest van het platform; bij de backend gaan we dat heroverwegen.)
- `frontend/`: `vandaag.html`/`.js` en `week.html`/`.js` in de landschapstocht, plus `landschap.css` en `landschap.js` (de parallax-motor).
- `src/voorbeeld/`: verzonnen voorbeeldweek. Geen echte gegevens.
- `ontwerp/verkooppagina-concept.html`: de verkooppagina als parallax-tocht door één dag.

## Volgende stappen

1. Dagplan zelf samenstellen en bewerken (nu kun je alleen suggesties toepassen).
2. Backend in dezelfde stack als ACCRD, met accounts en opslag van slaap en energie (AVG).
3. Drempels kalibreren met echte dagen.
