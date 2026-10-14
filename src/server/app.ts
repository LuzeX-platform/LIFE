import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { db } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { profielRoutes } from "./routes/profiel.js";
import { blokRoutes } from "./routes/blokken.js";
import { checkinRoutes } from "./routes/checkins.js";
import { accountRoutes } from "./routes/account.js";
import { voorbeeldRoutes } from "./routes/voorbeeld.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function bouwApp(opties: { logger?: boolean } = {}) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    // Liever niet opstarten: een mislukte deploy laat de vorige versie live, een server zonder
    // geheim laat niemand meer in.
    throw new Error("JWT_SECRET ontbreekt of is korter dan 32 tekens.");
  }
  // trustProxy: achter de Render-proxy ziet de server anders overal http en het IP van de proxy.
  const app = Fastify({ logger: opties.logger ?? true, trustProxy: true, bodyLimit: 256 * 1024 });
  await app.register(fastifyCookie);

  // Streng, met één bewuste versoepeling: stijlen inline (de landschapslagen zijn SVG met
  // stijlattributen). Geen externe hosts: de lettertypes staan in frontend/fonts, zodat er bij
  // een bezoek niets naar derden gaat (AVG).
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"], fontSrc: ["'self'"], connectSrc: ["'self'"],
        formAction: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
      },
    },
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyRateLimit, {
    global: true, max: 300, timeWindow: "1 minute", keyGenerator: r => r.ip,
    allowList: r => !r.url.startsWith("/api/"),
    errorResponseBuilder: (_r, c) => ({ statusCode: 429, errorCode: "TE_VEEL_VERZOEKEN", bericht: `Te veel verzoeken. Probeer het over ${Math.ceil(c.ttl / 1000)} seconden opnieuw.` }),
  });

  // Minimale CSRF-verdediging naast de SameSite=Strict-cookie: een schrijvend verzoek met een
  // Origin die niet bij deze host hoort, wordt geweigerd.
  app.addHook("onRequest", async (request, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    try {
      if (new URL(origin).host !== request.headers.host) return reply.code(403).send({ errorCode: "ONGELDIGE_OORSPRONG" });
    } catch { return reply.code(403).send({ errorCode: "ONGELDIGE_OORSPRONG" }); }
  });

  // Gezondheidscontrole voor Render: faalt als de database niet antwoordt.
  app.get("/api/gezondheid", async (_request, reply) => {
    try { await db.$queryRaw`SELECT 1`; return { ok: true }; }
    catch { return reply.code(503).send({ ok: false }); }
  });

  await app.register(authRoutes);
  await app.register(profielRoutes);
  await app.register(blokRoutes);
  await app.register(checkinRoutes);
  await app.register(accountRoutes);
  await app.register(voorbeeldRoutes);

  // De frontend en de planlogica (dezelfde bestanden als in de tests) komen uit één proces.
  await app.register(fastifyStatic, { root: path.join(__dirname, "..", "..", "frontend"), prefix: "/", index: "vandaag.html" });
  await app.register(fastifyStatic, { root: path.join(__dirname, "..", "planner"), prefix: "/planner/", decorateReply: false });
  return app;
}
