-- CreateEnum
CREATE TYPE "AccountMode" AS ENUM ('DEMO', 'PAPER', 'LIVE_READONLY');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE_BUY', 'TRADE_SELL', 'DIVIDEND', 'FEE_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SystemEventLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "AccountMode" NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'NOK',
    "startingCapital" DECIMAL(18,4) NOT NULL,
    "cashBalance" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_observations" (
    "id" TEXT NOT NULL,
    "benchmarkKey" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "avgCost" DECIMAL(18,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt" TIMESTAMP(3),
    "fillPrice" DECIMAL(18,4),
    "fillPriceObservedAt" TIMESTAMP(3),
    "feeAmount" DECIMAL(18,4),
    "slippageAmount" DECIMAL(18,4),
    "totalAmount" DECIMAL(18,4),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_ledger_entries" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tradingDate" DATE NOT NULL,
    "startValue" DECIMAL(18,4) NOT NULL,
    "endValue" DECIMAL(18,4) NOT NULL,
    "netDeposits" DECIMAL(18,4) NOT NULL,
    "realizedPnl" DECIMAL(18,4) NOT NULL,
    "unrealizedPnlChange" DECIMAL(18,4) NOT NULL,
    "costs" DECIMAL(18,4) NOT NULL,
    "fxImpact" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "dayResult" DECIMAL(18,4) NOT NULL,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "benchmarkStartValue" DECIMAL(18,6),
    "benchmarkEndValue" DECIMAL(18,6),
    "marketClosed" BOOLEAN NOT NULL DEFAULT false,
    "dataIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "level" "SystemEventLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contextJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_mode_key" ON "accounts"("userId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_ticker_exchange_key" ON "instruments"("ticker", "exchange");

-- CreateIndex
CREATE INDEX "price_observations_instrumentId_observedAt_idx" ON "price_observations"("instrumentId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_observations_instrumentId_observedAt_key" ON "price_observations"("instrumentId", "observedAt");

-- CreateIndex
CREATE INDEX "benchmark_observations_benchmarkKey_observedAt_idx" ON "benchmark_observations"("benchmarkKey", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_observations_benchmarkKey_observedAt_key" ON "benchmark_observations"("benchmarkKey", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "positions_accountId_instrumentId_key" ON "positions"("accountId", "instrumentId");

-- CreateIndex
CREATE INDEX "orders_accountId_status_idx" ON "orders"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_accountId_idempotencyKey_key" ON "orders"("accountId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ledger_entries_orderId_key" ON "cash_ledger_entries"("orderId");

-- CreateIndex
CREATE INDEX "daily_snapshots_accountId_tradingDate_idx" ON "daily_snapshots"("accountId", "tradingDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_snapshots_accountId_tradingDate_key" ON "daily_snapshots"("accountId", "tradingDate");

-- CreateIndex
CREATE INDEX "system_events_category_createdAt_idx" ON "system_events"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kontantsaldo kan aldri bli negativ (ingen belåning i denne versjonen).
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_cash_balance_non_negative" CHECK ("cashBalance" >= 0);

-- Bare hele aksjer, aldri negativ beholdning, og kun positive ordrekvanta.
ALTER TABLE "positions" ADD CONSTRAINT "positions_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0);

-- En dag kan enten være stengt eller ha data (dataIncomplete er uavhengig av
-- marketClosed, men begge kan ikke bety "har fullstendige tall for en stengt
-- dag med manglende data" på en misvisende måte) — håndheves i kode, ikke
-- som en databasebegrensning, siden kombinasjonene er gyldige og nyanserte.

-- Prisobservasjoner og referanseindeks skal aldri ha negativ pris/verdi.
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_price_positive" CHECK ("price" > 0);
ALTER TABLE "benchmark_observations" ADD CONSTRAINT "benchmark_observations_value_positive" CHECK ("value" > 0);
