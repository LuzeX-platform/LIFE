import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";
import { datum } from "../schemas.js";
// @ts-ignore — gewone JavaScript, gedeeld met de tests en het prototype
import { week, weekDoelen } from "../../voorbeeld/week.js";

const plusDagen = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export async function voorbeeldRoutes(app: FastifyInstance) {
  // Vult een lege week met de voorbeeldweek, zodat een nieuwe gebruiker meteen iets ziet.
  // Doet niets als er in die week al blokken staan: nooit andermans eigen invoer overschrijven.
  app.post("/api/voorbeeld", { preHandler: vereisInlog }, async (request, reply) => {
    const p = z.object({ maandag: datum }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const id = request.gebruiker!.gebruikerId;
    const bezet = await db.blok.count({ where: { gebruikerId: id, datum: { gte: p.data.maandag, lte: plusDagen(p.data.maandag, 6) }, status: { in: ["gepland", "gedaan"] } } });
    if (bezet) return reply.code(409).send({ errorCode: "WEEK_NIET_LEEG" });
    const rijen = (week as { datum: string; blokken: any[] }[]).flatMap((dag, i) => dag.blokken.map(b => ({
      gebruikerId: id, datum: plusDagen(p.data.maandag, i), titel: b.titel, soort: b.soort, start: b.start, einde: b.einde,
      vast: Boolean(b.vast), persoon: Boolean(b.persoon), uitstelbaar: Boolean(b.uitstelbaar), zwaar: Boolean(b.zwaar),
      plek: b.plek ?? null, reisNa: b.reisNa ?? null, lichterTitel: b.lichter?.titel ?? null, lichterDuur: b.lichter?.duur ?? null,
    })));
    await db.blok.createMany({ data: rijen });
    await db.profiel.upsert({ where: { gebruikerId: id }, update: { weekDoelen }, create: { gebruikerId: id, weekDoelen } });
    return reply.code(201).send({ aantal: rijen.length });
  });
}
