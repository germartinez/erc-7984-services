import { Pool } from 'pg';
import type { Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processTransfers } from '../src/indexer/lib/utils';
import { tryDecrypt } from '../src/indexer/lib/zama';
import { CHAIN_ID, RECIPIENT, SENDER, dbReader, resetDb, transferFrom } from './utils';

vi.mock('../src/indexer/lib/zama', () => ({ tryDecrypt: vi.fn() }));

vi.mock('pg', async () => {
  const { createMemPg } = await import('./utils');
  return createMemPg();
});

const decrypt = vi.mocked(tryDecrypt);
const db = dbReader(new Pool());

describe('confidential transfer indexing (real db.ts on pg-mem)', () => {
  beforeEach(() => {
    decrypt.mockReset();
    resetDb();
  });

  it('happy path: a decryptable transfer is persisted DECRYPTED and moves both balances', async () => {
    decrypt.mockResolvedValue({ kind: 'decrypted', value: 500n });

    await processTransfers(CHAIN_ID, [transferFrom()], 100);

    const row = await db.transferRow('0xdead', 0);
    expect(row.decrypt_status).toBe('DECRYPTED');
    expect(String(row.amount_clear)).toBe('500');

    expect(await db.balanceOf(RECIPIENT)).toBe('500');
    expect(await db.balanceOf(SENDER)).toBe('-500');
  });

  it('negative: an undecryptable transfer is NOT dropped and does not move the balance', async () => {
    decrypt.mockResolvedValue({
      kind: 'pending',
      reason: 'holder not entitled (ACL isAllowed=false)',
    });

    await processTransfers(CHAIN_ID, [transferFrom({ amountHandle: '0xbbbb' as Hex })], 100);

    const row = await db.transferRow('0xdead', 0);
    expect(row).toBeDefined();
    expect(row.decrypt_status).toBe('PENDING');
    expect(row.amount_clear).toBeNull();
    expect(row.amount_handle).toBe('0xbbbb');

    expect(await db.balanceOf(RECIPIENT)).toBe('0');
  });
});
