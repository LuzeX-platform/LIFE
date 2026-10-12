import type { FastifyInstance } from "fastify";
import { COOKIE_NAAM, cookieOpties, hashWachtwoord, maakToken, nepVerificatie, verifieerWachtwoord } from "../auth.js";
import { db } from "../db.js";
import { vereisInlog } from "../vereisInlog.js";
import { inlog, registratie } from "../schemas.js";

// Strenge limiet per IP voor wie wachtwoorden probeert te raden. Per route en niet globaal: de
// rest van de API mag ruimer.
const STRENG = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/registreren", STRENG, async (request, reply) => {
    const p = registratie.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER", fouten: p.error.flatten().fieldErrors });
    const bestaand = await db.gebruiker.findUnique({ where: { email: p.data.email } });
    if (bestaand) return reply.code(409).send({ errorCode: "EMAIL_BESTAAT" });
    const g = await db.gebruiker.create({
      data: {
        email: p.data.email,
        wachtwoordHash: await hashWachtwoord(p.data.wachtwoord),
        toestemmingGezondheid: p.data.toestemmingGezondheid ? new Date() : null,
        profiel: { create: {} },
      },
    });
    reply.setCookie(COOKIE_NAAM, maakToken({ gebruikerId: g.id, email: g.email }), cookieOpties());
    return reply.code(201).send({ email: g.email, toestemmingGezondheid: Boolean(g.toestemmingGezondheid) });
  });

  app.post("/api/auth/inloggen", STRENG, async (request, reply) => {
    const p = inlog.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ errorCode: "ONGELDIGE_INVOER" });
    const g = await db.gebruiker.findUnique({ where: { email: p.data.email } });
    const goed = g ? await verifieerWachtwoord(g.wachtwoordHash, p.data.wachtwoord).catch(() => false) : (await nepVerificatie(p.data.wachtwoord), false);
    // Dezelfde melding voor "onbekend adres" en "fout wachtwoord".
    if (!g || !goed) return reply.code(401).send({ errorCode: "INLOG_ONJUIST" });
    reply.setCookie(COOKIE_NAAM, maakToken({ gebruikerId: g.id, email: g.email }), cookieOpties());
    return { email: g.email, toestemmingGezondheid: Boolean(g.toestemmingGezondheid) };
  });

  app.post("/api/auth/uitloggen", async (_request, reply) => {
    reply.clearCookie(COOKIE_NAAM, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/ik", { preHandler: vereisInlog }, async request => {
    const g = await db.gebruiker.findUniqueOrThrow({ where: { id: request.gebruiker!.gebruikerId } });
    return { email: g.email, toestemmingGezondheid: Boolean(g.toestemmingGezondheid) };
  });
}
