import type { FastifyReply, FastifyRequest } from "fastify";
import { COOKIE_NAAM, leesToken, type Sessie } from "./auth.js";
import { db } from "./db.js";

declare module "fastify" {
  interface FastifyRequest {
    gebruiker?: Sessie;
  }
}

// Autorisatie gebeurt hier, op de server. De frontend verbergt niets: wie geen sessie heeft,
// krijgt van elke /api-route (behalve inloggen en registreren) een 401.
export async function vereisInlog(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE_NAAM];
  if (!token) return reply.code(401).send({ errorCode: "NIET_INGELOGD" });
  try {
    request.gebruiker = leesToken(token);
  } catch {
    return reply.code(401).send({ errorCode: "SESSIE_ONGELDIG" });
  }
  // Bestaat het account nog? Een token blijft 8 uur geldig, ook nadat het account is verwijderd;
  // zonder deze controle komt zo'n verzoek bij de database als serverfout terecht in plaats van als 401.
  const bestaat = await db.gebruiker.findUnique({ where: { id: request.gebruiker.gebruikerId }, select: { id: true } });
  if (!bestaat) return reply.code(401).send({ errorCode: "SESSIE_ONGELDIG" });
}
