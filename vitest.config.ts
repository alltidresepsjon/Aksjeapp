import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Alle testfiler deler én fysisk Postgres-testdatabase og nullstiller
    // den med TRUNCATE mellom hver test. Kjør filer sekvensielt (ikke i
    // parallelle worker-prosesser) for å unngå at samtidige TRUNCATE-kall
    // fra ulike filer forårsaker deadlock mot hverandre.
    fileParallelism: false,
    // Eget testmiljø/database (borsliga_test) — se README for oppsett.
    // Kort tick-intervall/latens og alltid-åpne markedstider gjør testene
    // raske og deterministiske uavhengig av når de kjøres.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://borsliga:borsliga_dev_pw@localhost:5432/borsliga_test?schema=public",
      AUTH_SECRET: "test-secret-do-not-use-in-production",
      MARKET_DATA_PROVIDER: "mock",
      MOCK_MARKET_SEED: "test-seed",
      MOCK_MARKET_TICK_INTERVAL_MS: "200",
      MOCK_MARKET_LATENCY_MS: "20",
      BROKERAGE_FLAT_FEE_NOK: "39",
      BROKERAGE_PERCENT_FEE: "0.001",
      ORDER_MAX_WAIT_MS: "5000",
      MARKET_OPEN_HOUR: "0",
      MARKET_CLOSE_HOUR: "23",
      STARTING_CASH_NOK: "100000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
