import argon2 from "argon2";
import jwt from "jsonwebtoken";

export const COOKIE_NAAM = process.env.SESSION_COOKIE_NAME ?? "life_sessie";
const SESSIE_UUR = 8;

function geheim(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET ontbreekt of is korter dan 32 tekens.");
  return s;
}

export interface Sessie {
  gebruikerId: string;
  email: string;
}

export const hashWachtwoord = (w: string) => argon2.hash(w, { type: argon2.argon2id });
export const verifieerWachtwoord = (hash: string, w: string) => argon2.verify(hash, w);

// Een hash om tegen te verifiëren als het e-mailadres niet bestaat. Zonder dit antwoordt "onbekend
// adres" merkbaar sneller dan "fout wachtwoord", en kan iemand zo uitzoeken wie er een account heeft.
let nepHash: string | null = null;
export async function nepVerificatie(w: string): Promise<void> {
  nepHash ??= await hashWachtwoord("nep-wachtwoord-voor-timing");
  await argon2.verify(nepHash, w).catch(() => false);
}

export const maakToken = (s: Sessie) => jwt.sign(s, geheim(), { expiresIn: `${SESSIE_UUR}h` });
export const leesToken = (t: string) => jwt.verify(t, geheim()) as Sessie;

export const cookieOpties = () => ({
  httpOnly: true,
  // Strict: de cookie gaat nooit mee met een verzoek vanaf een andere site (CSRF).
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSIE_UUR * 3600,
});
