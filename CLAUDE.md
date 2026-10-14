# CLAUDE.md — LIFE

LIFE stemt werk, sport, gezin en vrije tijd op elkaar af en geeft elke ochtend een haalbaar
dagplan, inclusief wat je vandaag beter niet doet. Los van de andere LuzeX-projecten: eigen
database, eigen Render-service, eigen geheimen.

**Stand:** werkende app (inloggen, invullen, dashboard) met Fastify, Prisma en PostgreSQL, klaar om op Render te draaien maar nog niet uitgerold. Staat er hier code die dit bestand niet noemt, dan
heeft de code gelijk en is dit bestand verouderd — werk het bij in dezelfde wijziging.

## Regels van het LuzeX-platform

Overgenomen uit de hub (`LuzeX-platform/hub`, `CLAUDE.md`). ACCRD is de referentie: twijfel je
hóe iets moet, kijk hoe ACCRD het doet. Wijk je af, schrijf op die plek waaróm.

- **Nederlands**, overal: routes, variabelen, tabelnamen, commitberichten, commentaar. Getallen
  via `nl-NL`.
- **Geen build-stap, geen framework** in de frontend. De planlogica (`src/planner/`) is daarom gewone ES-modules met JSDoc in plaats van TypeScript, zodat de browser hem rechtstreeks laadt; de server (`src/server/`) is wel TypeScript, net als ACCRD. Statische HTML/CSS/JS, geserveerd door
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
- **Het ontwerp is de landschapstocht, ook voor het dashboard.** Parallax-landschappen in lagen,
  een klok die meeloopt van ochtend tot nacht, en elk dagdeel als hoofdstuk met een werkend
  paneel erin (`frontend/landschap.css` en `landschap.js`; één pagina met dag, week en dashboard, Invullen apart). Eerder stond hier
  "rustig en bruikbaar eerst", en dat leidde tot een vlakke app-look die niemand wilde. Bouw
  nieuwe schermen dus in dezelfde tocht en maak geen apart, vlak dashboard. Overweeg je toch
  een afwijking, vraag het eerst. Beslist en afgevallen: Liquid Glass voor de lagen (te zwaar
  voor het scrollen en niet gewenst).
- **Interface in de panelen blijft monochroom;** kleur zit in het landschap en betekent in de
  panelen alleen status (groen haalbaar, oranje krap, rood te vol).
- **Geen dubbele id's.** Een sectie en een element erin deelden eens een id, waardoor de code
  het hele hoofdstuk overschreef. Geef containers een eigen naam (`liever-lijst`).

## Beveiliging en privacy in de code

- **Lettertypes en scripts komen van onze eigen server.** De CSP staat geen externe hosts toe en er
  gaat bij een bezoek niets naar derden. Voeg geen Google Fonts of CDN toe.
- **Elke gegevensroute vraagt een sessie** (`vereisInlog`) en controleert bij elk verzoek dat het
  account nog bestaat. Een blok van een ander is voor jou "niet gevonden" (404), niet "verboden".
- **Check-ins vragen toestemming** (`Gebruiker.toestemmingGezondheid`). Toestemming intrekken wist ze.
- **Alleen het verwijderen van een account verwijdert echt iets** (recht op vergetelheid, via
  `onDelete: Cascade`). Daarbuiten krijgt een blok de status `geschrapt` en blijft het bestaan.
- Schrijf een nieuwe route altijd met een test die bewijst dat een ander account erbij kan noch
  eraan kan.
- **Een agendabestand verlaat de browser niet als geheel.** Het bevat gegevens van anderen
  (deelnemers). `agendaImport.js` leest het lokaal; de server krijgt alleen de bevestigde afspraken
  (titel, tijd, plek, sleutel). Lees of bewaar deelnemers nooit.
