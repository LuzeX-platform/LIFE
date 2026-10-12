# LIFE

Eén app die je werk, sport, gezin en vrije tijd op elkaar afstemt. Je ziet niet alleen wat je
moet doen, maar ook wat je vandaag beter níét kunt doen. Elke ochtend een dagplan dat je echt
kunt halen.

Onderdeel van het LuzeX-platform; zie de hub voor hoe de projecten samenhangen.

## Stand van zaken

Een werkende app: account maken en inloggen, je gegevens invullen, een dashboard dat daarmee
rekent, en alles om op Render te draaien. Nog niet live; zie "Uitrollen".

- **Inloggen:** e-mail en wachtwoord (Argon2id), sessiecookie (httpOnly, SameSite=Strict),
  begrenzing op pogingen, controle op de herkomst van schrijvende verzoeken.
- **Invullen:** je profiel (wakkere uren, slaapdoel, weekdoelen), je agenda en een check-in
  (slaap en energie). Slaap en energie worden alleen bewaard met je uitdrukkelijke toestemming.
- **Dashboard:** Vandaag en Week, in de landschapstocht, berekend met de planlogica.
- **Je gegevens:** toestemming intrekken (wist de check-ins), alles downloaden, account verwijderen.

## Lokaal draaien

Je hebt Node 22 en PostgreSQL 16 nodig.

```bash
cp .env.example .env              # vul DATABASE_URL en JWT_SECRET (openssl rand -hex 32)
npm ci
npx prisma migrate dev            # maakt de tabellen aan
npm run dev                       # http://localhost:4000
```

```bash
npm test                          # de planregels, geen database nodig
TEST_DATABASE_URL=postgresql://... npm run test:server   # de server, 13 tests tegen een echte database
npm run dev:prototype             # het oude prototype met voorbeeldgegevens, zonder server
```

## Uitrollen op Render

De repository bevat alles: `Dockerfile`, `render.yaml` (webservice en PostgreSQL, Frankfurt) en
`.github/workflows/deploy.yml`. Wat jij nog moet doen, eenmalig:

1. Render: *New +*, *Blueprint*, kies deze repository, *Apply*. Render maakt de webservice
   `luzex-life` en de database `luzex-life-db` aan en genereert `JWT_SECRET` zelf.
2. Render, `luzex-life`, *Settings*, *Deploy Hook*: kopieer de URL.
3. GitHub, deze repository, *Settings*, *Secrets and variables*, *Actions*: maak het secret
   `RENDER_DEPLOY_HOOK` met die URL. Daarna zet elke push naar `main` een deploy in gang, zichtbaar
   in het tabblad Actions.
4. Optioneel een eigen domein, bijvoorbeeld `life.luzex.nl`: Render, *Settings*, *Custom Domains*
   en een CNAME bij je DNS-beheerder.

Bij elke start draait `prisma migrate deploy`. Lukt dat niet, dan start de server niet en blijft de
vorige versie live. De gezondheidscontrole `/api/gezondheid` controleert ook de database.

## Wat nog ontbreekt voor echte gebruikers

Dit zijn bekende gaten, geen vergeten dingen:

- **Wachtwoord vergeten en e-mailbevestiging.** Daarvoor is een mailserver nodig (SMTP, zoals bij
  ACCRD). Zonder dat kan niemand een vergeten wachtwoord herstellen.
- **Tweestapsverificatie.** ACCRD verplicht die. Voor LIFE, met gezondheidsgegevens, is dat ook
  gewenst; nog niet gebouwd.
- **Privacyverklaring, voorwaarden en een verwerkersovereenkomst met Render.** Zonder die teksten
  mag je geen echte gebruikers slaapgegevens laten invullen. Dit is juridisch werk, geen code.
- **Back-ups.** Controleer in Render wat het gekozen databaseplan aan back-ups meelevert.
- **Het Docker-image en de Render-uitrol zijn niet gebouwd of getest**, omdat er in de
  ontwikkelomgeving geen Docker of Render beschikbaar was. De server, de migraties (op een lege
  database) en de tests zijn wel gedraaid, en het `Dockerfile` volgt dat van ACCRD.

## Opbouw

- [`docs/planregels.md`](docs/planregels.md): hoe LIFE rekent, en de gemaakte keuzes.
- `src/planner/`: de planlogica, gewone ES-modules met JSDoc. Draait in de tests, op de server
  (gecompileerd) en in de browser (`/planner/`), zonder build-stap voor de frontend.
- `src/server/`: Fastify en Prisma in TypeScript. `prisma/schema.prisma` bevat de gegevens.
- `frontend/`: `inloggen`, `invullen`, `vandaag` en `week`, elk een `.html` en een `.js`, plus de
  landschapsmotor (`landschap.css`, `landschap.js`) en de lettertypes (`fonts/`, zelf gehost).
- `src/voorbeeld/` en `scripts/dev.mjs`: de voorbeeldweek en het prototype zonder server.
- `ontwerp/verkooppagina-concept.html`: de verkooppagina als parallax-tocht door één dag.
