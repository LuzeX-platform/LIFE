# CLAUDE.md — LIFE

LIFE stemt werk, sport, gezin en vrije tijd op elkaar af en geeft elke ochtend een haalbaar
dagplan, inclusief wat je vandaag beter niet doet. Los van de andere LuzeX-projecten: eigen
database, eigen Render-service, eigen geheimen.

**Stand:** planlogica (`src/planner/`, getest) en een prototype met voorbeeldgegevens. Nog geen backend. Staat er hier code die dit bestand niet noemt, dan
heeft de code gelijk en is dit bestand verouderd — werk het bij in dezelfde wijziging.

## Regels van het LuzeX-platform

Overgenomen uit de hub (`LuzeX-platform/hub`, `CLAUDE.md`). ACCRD is de referentie: twijfel je
hóe iets moet, kijk hoe ACCRD het doet. Wijk je af, schrijf op die plek waaróm.

- **Nederlands**, overal: routes, variabelen, tabelnamen, commitberichten, commentaar. Getallen
  via `nl-NL`.
- **Geen build-stap, geen framework** in de frontend. De planlogica is daarom gewone ES-modules met JSDoc in plaats van TypeScript, zodat de browser hem rechtstreeks laadt; ACCRD gebruikt TypeScript. Statische HTML/CSS/JS, geserveerd door
  de backend. Iconen zijn inline SVG (`viewBox="0 0 24 24"`, `fill="none"`,
  `stroke="currentColor"`, `stroke-width="1.6"`).
- **Strikt monochrome interface.** Kleur betekent status. Donkere modus is niet optioneel.
  Nieuwe kleurcombinaties halen 4,5:1 op `--bg` en `--surface` in beide modi; zet de ratio in
  een commentaar.
- **Aantallen en tijden zijn gehele getallen**: minuten, punten, geen floats.
- **Autorisatie op de server, nooit in de UI.**
- **Immutability.** Records worden niet verwijderd maar krijgen een terminale status of een
  nieuwe versie.
- **Commentaar legt de reden vast**, niet wat de regel eronder doet, inclusief afgewogen
  alternatieven.
- Render, regio **Frankfurt**. Geheimen in Render (`sync: false`) of GitHub-secrets, nooit in git.
- Branches: `feature/...`, `fix/...`, `polish/...`. `main` is wat live staat.

## Wat voor LIFE anders is

- **Gezondheidsgegevens.** Slaap en energie zijn bijzondere persoonsgegevens (AVG). Alleen met
  uitdrukkelijke toestemming, nooit in logs, nooit naar een derde partij zonder dat de gebruiker
  dat per koppeling aanzet.
- **Uitlegbaar boven slim.** Elke suggestie heeft een reden die de gebruiker kan nalezen en
  overrulen. De planlogica is daarom deterministisch (zie `docs/planregels.md`) en geen
  AI-model; AI mag hooguit de formulering van de uitleg helpen, nooit kiezen wat eruit moet.
- **LIFE stelt voor, de gebruiker beslist.** Geen automatische wijzigingen aan afspraken van
  mensen.
- **Het ontwerp** (`ontwerp/`) gebruikt landschappen met parallax als sfeer voor de
  verkooppagina. Voor het dashboard zelf geldt: rustig en bruikbaar eerst.
