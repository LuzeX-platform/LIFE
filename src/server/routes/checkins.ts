import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";
import { checkin, datum } from "../schemas.js";

export async function checkinRoutes(app: FastifyInstance) {
  app.get("/api/checkins", { preHandler: vereisInlog }, async (request, reply) => {
    const q = request.query as { van?: string; tot?: string };
    const van = datum.safeParse(q.van), tot = datum.safeParse(q.tot);
    if (!van.success || !tot.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const lijst = await db.checkin.findMany({ where: { gebruikerId: request.gebruiker!.gebruikerId, datum: { gte: van.data, lte: tot.data } } });
    return lijst.map(c => ({ datum: c.datum, slaapMinuten: c.slaapMinuten, energie: c.energie }));
  });

  app.put("/api/checkins/:datum", { preHandler: vereisInlog }, async (request, reply) => {
    const d = datum.safeParse((request.params as { datum: string }).datum);
    const p = checkin.safeParse(request.body);
    if (!d.success || !p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const id = request.gebruiker!.gebruikerId;
    // Slaap en energie zijn gezondheidsgegevens: zonder uitdrukkelijke toestemming bewaren we ze niet.
    const g = await db.gebruiker.findUniqueOrThrow({ where: { id } });
    if (!g.toestemmingGezondheid) return reply.code(403).send({ errorCode: "TOESTEMMING_ONTBREEKT" });
    const c = await db.checkin.upsert({
      where: { gebruikerId_datum: { gebruikerId: id, datum: d.data } },
      update: p.data, create: { gebruikerId: id, datum: d.data, ...p.data },
    });
    return { datum: c.datum, slaapMinuten: c.slaapMinuten, energie: c.energie };
  });
}
