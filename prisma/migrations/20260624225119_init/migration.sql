-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "transfers" (
    "chain_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "amount_handle" TEXT NOT NULL,
    "amount_clear" DECIMAL(78,0),
    "decrypt_status" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" BIGINT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "log_index" INTEGER NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("chain_id","tx_hash","log_index")
);

-- CreateTable
CREATE TABLE "balances" (
    "chain_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "net_decrypted" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "last_block" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "balances_pkey" PRIMARY KEY ("chain_id","token","address")
);

-- CreateTable
CREATE TABLE "indexer_status" (
    "chain_id" INTEGER NOT NULL,
    "last_indexed_block" BIGINT NOT NULL,

    CONSTRAINT "indexer_status_pkey" PRIMARY KEY ("chain_id")
);

-- CreateIndex
CREATE INDEX "transfers_from_idx" ON "transfers"("from");

-- CreateIndex
CREATE INDEX "transfers_to_idx" ON "transfers"("to");

-- CreateIndex
CREATE INDEX "transfers_retry_idx" ON "transfers"("chain_id", "decrypt_status");

-- CreateIndex
CREATE INDEX "balance_address_idx" ON "balances"("address");

