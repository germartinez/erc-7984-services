import type { Pool } from 'pg';
import type { Address, Hex } from 'viem';
import { type RawTransfer } from '../src/indexer/lib/utils';

export const CHAIN_ID = 11155111;
export const TOKEN = '0x00000000000000000000000000000000000000ff' as Address;
export const SENDER = '0x1111111111111111111111111111111111111111' as Address;
export const RECIPIENT = '0x2222222222222222222222222222222222222222' as Address;

const SCHEMA_DDL = `
  CREATE TABLE transfer (
    chain_id int NOT NULL,
    token text NOT NULL,
    "from" text NOT NULL,
    "to" text NOT NULL,
    amount_handle text NOT NULL,
    amount_clear numeric(78,0),
    decrypt_status text NOT NULL,
    block_number bigint NOT NULL,
    block_timestamp bigint NOT NULL,
    tx_hash text NOT NULL,
    log_index int NOT NULL,
    PRIMARY KEY (chain_id, tx_hash, log_index)
  );
  CREATE TABLE balances (
    chain_id int NOT NULL,
    token text NOT NULL,
    address text NOT NULL,
    net_decrypted numeric(78,0) NOT NULL DEFAULT 0,
    last_block bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (chain_id, token, address)
  );
  CREATE TABLE indexer_status (
    chain_id int PRIMARY KEY,
    last_indexed_block bigint NOT NULL
  );
`;

const RESET_KEY = '__resetMemDb';

export async function createMemPg() {
  const { newDb } = await import('pg-mem');
  const mem = newDb();
  mem.public.none(SCHEMA_DDL);
  const backup = mem.backup();
  (globalThis as Record<string, unknown>)[RESET_KEY] = () => backup.restore();
  const pg = mem.adapters.createPg();
  return { default: pg, Pool: pg.Pool, Client: pg.Client };
}

export const resetDb = (): void =>
  (globalThis as unknown as Record<string, () => void>)[RESET_KEY]();

export function dbReader(reads: Pool) {
  return {
    async balanceOf(address: Address): Promise<string> {
      const { rows } = await reads.query(
        `SELECT net_decrypted FROM balances WHERE chain_id = $1 AND token = $2 AND address = $3`,
        [CHAIN_ID, TOKEN.toLowerCase(), address.toLowerCase()],
      );
      return rows[0] ? String(rows[0].net_decrypted) : '0';
    },
    async transferRow(txHash: string, logIndex: number) {
      const { rows } = await reads.query(
        `SELECT decrypt_status, amount_clear, amount_handle
           FROM transfer WHERE chain_id = $1 AND tx_hash = $2 AND log_index = $3`,
        [CHAIN_ID, txHash, logIndex],
      );
      return rows[0];
    },
  };
}

export function transferFrom(overrides: Partial<RawTransfer> = {}): RawTransfer {
  return {
    chainId: CHAIN_ID,
    token: TOKEN,
    from: SENDER,
    to: RECIPIENT,
    amountHandle: '0xaaaa' as Hex,
    blockNumber: 100n,
    blockTimestamp: 1_700_000_000n,
    transactionHash: '0xdead' as Hex,
    logIndex: 0,
    ...overrides,
  };
}
