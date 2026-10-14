import type { FastifyInstance } from "fastify";
import type { Blok } from "@prisma/client";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";
import { datum, importLijst, nieuwBlok, wijzigBlok } from "../schemas.js";

// De vorm die de planlogica verwacht (src/planner/typen.js), plus id, datum en status.
export const naarApi = (b: Blok) => ({
  id: b.id, datum: b.datum, titel: b.titel, soort: b.soort, start: b.start, einde: b.einde,
  vast: b.vast, persoon: b.persoon, uitstelbaar: b.uitstelbaar, zwaar: b.zwaar,
  plek: b.plek ?? undefined, reisNa: b.reisNa ?? undefined,
  lichter: b.lichterTitel && b.lichterDuur ? { titel: b.lichterTitel, duur: b.lichterDuur } : undefined,
  status: b.status,
});

const dagen = (van: string, tot: string) => Math.round((Date.parse(`${tot}T12:00:00Z`) - Date.parse(`${van}T12:00:00Z`)) / 86400000);

export async function blokRoutes(app: FastifyInstance) {
  app.get("/api/blokken", { preHandler: vereisInlog }, async (request, reply) => {
    const q = request.query as { van?: string; tot?: string };
    const van = datum.safeParse(q.van), tot = datum.safeParse(q.tot);
    if (!van.success || !tot.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    // Maximaal 35 dagen: genoeg voor een maandoverzicht, te weinig om per ongeluk alles op te halen.
    if (dagen(van.data, tot.data) < 0 || dagen(van.data, tot.data) > 35) return reply.code(400).send({ errorCode: "PERIODE_ONGELDIG" });
    const lijst = await db.blok.findMany({
      where: { gebruikerId: request.gebruiker!.gebruikerId, datum: { gte: van.data, lte: tot.data }, status: { in: ["gepland", "gedaan"] } },
      orderBy: [{ datum: "asc" }, { start: "asc" }],
    });
    return lijst.map(naarApi);
  });

  app.post("/api/blokken", { preHandler: vereisInlog }, async (request, reply) => {
    const p = nieuwBlok.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: p.error.flatten() });
    const { lichter, plek, reisNa, ...rest } = p.data;
    const b = await db.blok.create({
      data: { ...rest, gebruikerId: request.gebruiker!.gebruikerId, plek: plek ?? null, reisNa: reisNa ?? null, lichterTitel: lichter?.titel ?? null, lichterDuur: lichter?.duur ?? null },
    });
    return reply.code(201).send(naarApi(b));
  });

  // Afspraken uit een agendabestand. Zelfde afspraak twee keer inladen geeft geen dubbele blokken
  // (unieke sleutel per gebruiker), en een blok dat je zelf weghaalde komt niet terug omdat het
  // met status "geschrapt" blijft bestaan.
  app.post("/api/blokken/importeren", { preHandler: vereisInlog, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const p = importLijst.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: p.error.flatten() });
    const gebruikerId = request.gebruiker!.gebruikerId;
    const r = await db.blok.createMany({
      skipDuplicates: true,
      data: p.data.afspraken.map(a => ({
        gebruikerId, datum: a.datum, titel: a.titel, soort: a.soort, start: a.start, einde: a.einde,
        vast: a.vast, persoon: a.persoon, plek: a.plek ?? null, bron: "ics", externeSleutel: a.sleutel,
      })),
    });
    return reply.code(201).send({ nieuw: r.count, overgeslagen: p.data.afspraken.length - r.count });
  });

  // Wijzigen, afvinken, verschuiven, naar een andere dag zetten en "verwijderen" (status
  // geschrapt) zijn allemaal dezelfde route. Een blok wordt nooit echt verwijderd.
  app.patch("/api/blokken/:id", { preHandler: vereisInlog }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = wijzigBlok.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: (p as any).error.flatten() });
    const huidig = await db.blok.findFirst({ where: { id, gebruikerId: request.gebruiker!.gebruikerId } });
    // 404 en geen 403: een blok van een ander bestaat voor jou niet.
    if (!huidig) return reply.code(404).send({ errorCode: "NIET_GEVONDEN" });
    const { lichter, plek, reisNa, ...rest } = p.data as any;
    const start = rest.start ?? huidig.start, einde = rest.einde ?? huidig.einde;
    if (einde <= start) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: { fieldErrors: { einde: ["Het einde moet na de start liggen"] } } });
    const data: Record<string, unknown> = { ...rest };
    if (plek !== undefined) data.plek = plek;
    if (reisNa !== undefined) data.reisNa = reisNa;
    if (lichter !== undefined) { data.lichterTitel = lichter?.titel ?? null; data.lichterDuur = lichter?.duur ?? null; }
    const b = await db.blok.update({ where: { id }, data });
    return naarApi(b);
  });
}
