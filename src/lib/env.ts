import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  ALLOWED_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  DEMO_MARKET_SEED: z.string().default("aksjeanalyse-demo"),
  BASE_CURRENCY: z.string().default("NOK"),
  STARTING_CAPITAL: z.coerce.number().positive().default(1_000_000),
  BROKERAGE_FLAT_FEE: z.coerce.number().nonnegative().default(39),
  BROKERAGE_PERCENT_FEE: z.coerce.number().nonnegative().default(0.001),
  SLIPPAGE_PERCENT: z.coerce.number().nonnegative().default(0.0005),
  MONTHLY_AI_BUDGET_NOK: z.coerce.number().nonnegative().default(300),
  MONTHLY_DATA_BUDGET_NOK: z.coerce.number().nonnegative().default(200),
  ANTHROPIC_API_KEY: z.string().default(""),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function parseEnv(): Env {
  if (!cached) {
    cached = envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
      DEMO_MARKET_SEED: process.env.DEMO_MARKET_SEED,
      BASE_CURRENCY: process.env.BASE_CURRENCY,
      STARTING_CAPITAL: process.env.STARTING_CAPITAL,
      BROKERAGE_FLAT_FEE: process.env.BROKERAGE_FLAT_FEE,
      BROKERAGE_PERCENT_FEE: process.env.BROKERAGE_PERCENT_FEE,
      SLIPPAGE_PERCENT: process.env.SLIPPAGE_PERCENT,
      MONTHLY_AI_BUDGET_NOK: process.env.MONTHLY_AI_BUDGET_NOK,
      MONTHLY_DATA_BUDGET_NOK: process.env.MONTHLY_DATA_BUDGET_NOK,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    });
  }
  return cached;
}

// Validerer FØRST GANG en variabel faktisk leses, ikke idet modulen
// importeres. Next.js sin build-fase ("Collecting page data") importerer
// hver rute for å inspisere den, uten å faktisk kjøre handleren — en
// build-container uten miljøvariabler satt (vanlig på f.eks. Railway, der
// variabler kan være tilgjengelige først ved kjøretid) skal derfor aldri
// kunne felle selve bygget. Server-only — importer aldri fra en
// "use client"-komponent.
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return parseEnv()[prop as keyof Env];
  },
});
