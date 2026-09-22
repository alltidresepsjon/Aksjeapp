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
    // parallelle worker-prosesser) for å unngå deadlock mellom filer.
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://aksjeanalyse:dev_local_pw@localhost:5432/aksjeanalyse_test?schema=public",
      AUTH_SECRET: "test-secret-do-not-use-in-production",
      ALLOWED_EMAILS: "allowlisted@example.test",
      DEMO_MARKET_SEED: "test-seed",
      BASE_CURRENCY: "NOK",
      STARTING_CAPITAL: "1000000",
      BROKERAGE_FLAT_FEE: "39",
      BROKERAGE_PERCENT_FEE: "0.001",
      SLIPPAGE_PERCENT: "0.0005",
      MONTHLY_AI_BUDGET_NOK: "300",
      MONTHLY_DATA_BUDGET_NOK: "200",
      ANTHROPIC_API_KEY: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
