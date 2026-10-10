# Planregels (concept)

Hoe LIFE rekent. Alles in hele minuten en hele punten. Dit is een eerste voorstel; wat nog
open staat, staat onderaan.

## Invoer

- **Vaste blokken:** werk, school, afspraken, reistijd. LIFE verschuift ze nooit zelf.
- **Wensen met een weekdoel in minuten:** sport, vrienden, vrije tijd.
- **Slaap:** de afgelopen nacht en het doel van de gebruiker.
- **Energie:** zelfopgave van 1 tot 5 aan het begin van de dag.

## Haalbaarheid (0 tot 100)

Begin op 100 en trek af:

- **Vulling:** minuten gepland gedeeld door de wakkere, vrije minuten. Boven 85% wordt het
  streng.
- **Slaaptekort:** 5 punten per 30 minuten onder het doel.
- **Overgangen:** minder dan 10 minuten tussen twee blokken op verschillende plekken kost punten.
- **Zware blokken achter elkaar**, bijvoorbeeld training direct na een lange werkdag.

Onder 60 zegt LIFE expliciet dat de dag te vol is. De precieze punten per regel zijn nog te
kalibreren met echte dagen.

## Wat eruit moet ("liever niet")

LIFE schrapt in deze volgorde, en noemt altijd een reden en een lichter alternatief:

1. Wat zonder gevolgen kan worden uitgesteld, zoals extra werkuren.
2. Wensen die binnen het weekdoel later in de week nog passen.
3. Zware vormen van een wens: 10 km hardlopen wordt een wandeling van 30 minuten.

**Nooit:** een vaste afspraak, een afspraak met een persoon, of sport twee keer op rij
schrappen zonder dat LIFE dat zegt.

## Gemaakte keuzes

Voorlopig vastgelegd als uitgangspunt; omgooien kan, de tests laten zien wat er verschuift.

1. **Slaap:** zelf invullen. Een koppeling met Apple Gezondheid kan later, met aparte toestemming.
2. **Agenda:** eigen agenda. Koppelen aan Google of Apple Agenda komt later.
3. **Gezin:** één persoon. Een gedeelde agenda met partner en kinderen is een eigen ontwerp.
4. **Verplaatsen:** LIFE doet alleen voorstellen en wijzigt nooit zelf iets.

## Hoe het in de code zit

De regels staan in `src/planner/`, zonder afhankelijkheden, en zijn volledig getest
(`npm test`). `REGELS` in `haalbaarheid.js` bevat alle drempels op één plek.

- `haalbaarheid.js`: score en strafpunten, elk met een reden.
- `lieverNiet.js`: wat eruit kan, in vaste volgorde; stopt zodra de dag haalbaar is.
- `botsingen.js`: overlap, met een voorstel als er een veilige oplossing is.
- `week.js`: gepland tegenover weekdoel, "achter" onder 80%.

**Nog open:** de drempels zijn nog niet gekalibreerd met echte dagen. Pas dat aan zodra er
gebruik is, niet eerder.
