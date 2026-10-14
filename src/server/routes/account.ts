import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { COOKIE_NAAM, verifieerWachtwoord } from "../auth.js";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";

export async function accountRoutes(app: FastifyInstance) {
  // Toestemming voor gezondheidsgegevens geven of intrekken. Intrekken verwijdert de bestaande
  // check-ins: toestemming intrekken zonder dat de gegevens verdwijnen is geen intrekking.
  app.post("/api/account/toestemming", { preHandler: vereisInlog }, async (request, reply) => {
    const p = z.object({ gegeven: z.boolean() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const id = request.gebruiker!.gebruikerId;
    if (p.data.gegeven) await db.gebruiker.update({ where: { id }, data: { toestemmingGezondheid: new Date() } });
    else await db.$transaction([db.checkin.deleteMany({ where: { gebruikerId: id } }), db.gebruiker.update({ where: { id }, data: { toestemmingGezondheid: null } })]);
    return { toestemmingGezondheid: p.data.gegeven };
  });

  // Recht op dataportabiliteit: alles wat we van je hebben, als JSON.
  app.get("/api/account/export", { preHandler: vereisInlog }, async (request, reply) => {
    const id = request.gebruiker!.gebruikerId;
    const g = await db.gebruiker.findUniqueOrThrow({ where: { id }, include: { profiel: true, blokken: true, checkins: true } });
    reply.header("content-disposition", 'attachment; filename="life-gegevens.json"');
    return { email: g.email, aangemaaktOp: g.aangemaaktOp, toestemmingGezondheid: g.toestemmingGezondheid, profiel: g.profiel, blokken: g.blokken, checkins: g.checkins };
  });

  // Recht op vergetelheid. Dit is de enige plek waar echt iets wordt verwijderd; de regel
  // "records worden niet verwijderd" geldt voor de agenda tijdens het gebruik, niet hiervoor.
  // Vraagt het wachtwoord opnieuw, zodat een gestolen sessie een account niet kan wissen.
  app.post("/api/account/verwijderen", { preHandler: vereisInlog, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const p = z.object({ wachtwoord: z.string().max(200) }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const id = request.gebruiker!.gebruikerId;
    const g = await db.gebruiker.findUniqueOrThrow({ where: { id } });
    if (!(await verifieerWachtwoord(g.wachtwoordHash, p.data.wachtwoord).catch(() => false))) return reply.code(403).send({ errorCode: "WACHTWOORD_ONJUIST" });
    await db.gebruiker.delete({ where: { id } });
    reply.clearCookie(COOKIE_NAAM, { path: "/" });
    return { ok: true };
  });
}
