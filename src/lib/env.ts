import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  MARKET_DATA_PROVIDER: z.enum(["mock"]).default("mock"),
  MOCK_MARKET_SEED: z.string().default("borsliga-demo"),
  MOCK_MARKET_TICK_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  MOCK_MARKET_LATENCY_MS: z.coerce.number().int().nonnegative().default(500),
  BROKERAGE_FLAT_FEE_NOK: z.coerce.number().nonnegative().default(39),
  BROKERAGE_PERCENT_FEE: z.coerce.number().nonnegative().default(0.001),
  ORDER_MAX_WAIT_MS: z.coerce.number().int().positive().default(20000),
  MARKET_OPEN_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  MARKET_CLOSE_HOUR: z.coerce.number().int().min(0).max(23).default(17),
  STARTING_CASH_NOK: z.coerce.number().positive().default(100000),
});

// Parsed once, on the server only. Never import this module from a
// "use client" component.
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER,
  MOCK_MARKET_SEED: process.env.MOCK_MARKET_SEED,
  MOCK_MARKET_TICK_INTERVAL_MS: process.env.MOCK_MARKET_TICK_INTERVAL_MS,
  MOCK_MARKET_LATENCY_MS: process.env.MOCK_MARKET_LATENCY_MS,
  BROKERAGE_FLAT_FEE_NOK: process.env.BROKERAGE_FLAT_FEE_NOK,
  BROKERAGE_PERCENT_FEE: process.env.BROKERAGE_PERCENT_FEE,
  ORDER_MAX_WAIT_MS: process.env.ORDER_MAX_WAIT_MS,
  MARKET_OPEN_HOUR: process.env.MARKET_OPEN_HOUR,
  MARKET_CLOSE_HOUR: process.env.MARKET_CLOSE_HOUR,
  STARTING_CASH_NOK: process.env.STARTING_CASH_NOK,
});
