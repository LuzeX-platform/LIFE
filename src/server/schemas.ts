import { z } from "zod";

export const SOORTEN = ["werk", "school", "gezin", "sport", "vrienden", "vrije-tijd", "reis", "overig"] as const;
export const STATUSSEN = ["gepland", "gedaan", "geschrapt", "doorgeschoven"] as const;

export const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-DD").refine(
  d => !Number.isNaN(Date.parse(`${d}T12:00:00Z`)), "Ongeldige datum");
const minuut = z.number().int().min(0).max(24 * 60);

const blokVelden = {
  datum,
  titel: z.string().trim().min(1).max(120),
  soort: z.enum(SOORTEN),
  start: minuut,
  einde: minuut,
  vast: z.boolean().default(false),
  persoon: z.boolean().default(false),
  uitstelbaar: z.boolean().default(false),
  zwaar: z.boolean().default(false),
  plek: z.string().trim().max(60).nullable().optional(),
  reisNa: z.number().int().min(0).max(240).nullable().optional(),
  lichter: z.object({ titel: z.string().trim().min(1).max(120), duur: z.number().int().min(5).max(24 * 60) }).nullable().optional(),
};

export const nieuwBlok = z.object(blokVelden).refine(b => b.einde > b.start, { message: "Het einde moet na de start liggen", path: ["einde"] });

// Bij een wijziging mag alles ontbreken. De controle start < einde gebeurt in de route, want die
// heeft ook de waarden uit de database nodig.
export const wijzigBlok = z.object({
  ...Object.fromEntries(Object.entries(blokVelden).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])),
  status: z.enum(STATUSSEN).optional(),
}).strict() as unknown as z.ZodType<Partial<z.infer<typeof nieuwBlok>> & { status?: (typeof STATUSSEN)[number] }>;

export const profiel = z.object({
  wakkerVan: minuut, wakkerTot: minuut,
  slaapDoel: z.number().int().min(240).max(720),
  weekDoelen: z.record(z.enum(SOORTEN), z.number().int().min(0).max(6000)),
}).refine(p => p.wakkerTot - p.wakkerVan >= 8 * 60, { message: "Je wakkere dag moet minstens 8 uur zijn", path: ["wakkerTot"] });

export const checkin = z.object({ slaapMinuten: z.number().int().min(0).max(900), energie: z.number().int().min(1).max(5) });

// Minstens 12 tekens en geen maximum dat een wachtwoordmanager in de weg zit (wel een bovengrens
// tegen misbruik van het hashen).
export const registratie = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  wachtwoord: z.string().min(12, "Minstens 12 tekens").max(200),
  toestemmingGezondheid: z.boolean().default(false),
});
export const inlog = z.object({ email: z.string().trim().toLowerCase().max(200), wachtwoord: z.string().max(200) });
