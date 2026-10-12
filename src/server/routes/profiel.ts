import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";
import { profiel } from "../schemas.js";

export async function profielRoutes(app: FastifyInstance) {
  app.get("/api/profiel", { preHandler: vereisInlog }, async request => {
    const p = await db.profiel.upsert({ where: { gebruikerId: request.gebruiker!.gebruikerId }, update: {}, create: { gebruikerId: request.gebruiker!.gebruikerId } });
    return { wakkerVan: p.wakkerVan, wakkerTot: p.wakkerTot, slaapDoel: p.slaapDoel, weekDoelen: p.weekDoelen };
  });

  app.put("/api/profiel", { preHandler: vereisInlog }, async (request, reply) => {
    const p = profiel.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: p.error.flatten() });
    const id = request.gebruiker!.gebruikerId;
    const r = await db.profiel.upsert({ where: { gebruikerId: id }, update: p.data, create: { gebruikerId: id, ...p.data } });
    return { wakkerVan: r.wakkerVan, wakkerTot: r.wakkerTot, slaapDoel: r.slaapDoel, weekDoelen: r.weekDoelen };
  });
}
