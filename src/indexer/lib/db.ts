import { config } from '@/config';
import { Pool, type PoolClient } from 'pg';
import { type BalanceDelta, type DecryptStatus, type TransferRow } from './utils';

const pool = new Pool({ connectionString: config.db.url });

export async function getLastBlockIndexed(chainId: number): Promise<number | undefined> {
  const { rows } = await pool.query<{ last_indexed_block: string }>(
    `SELECT last_indexed_block FROM indexer_status WHERE chain_id = $1`,
    [chainId],
  );
  return rows[0] ? Number(rows[0].last_indexed_block) : undefined;
}

async function applyDeltas(
  client: PoolClient,
  chainId: number,
  token: string,
  deltas: BalanceDelta[],
  lastBlock: bigint,
): Promise<void> {
  for (const d of deltas) {
    const address = d.address.toLowerCase();
    await client.query(
      `INSERT INTO balances
        (chain_id, token, address, net_decrypted, last_block)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chain_id, token, address) DO UPDATE SET
        net_decrypted = balances.net_decrypted + EXCLUDED.net_decrypted,
        last_block = GREATEST(balances.last_block, EXCLUDED.last_block)`,
      [chainId, token.toLowerCase(), address, d.net.toString(), lastBlock.toString()],
    );
  }
}

interface IndexedTransfer {
  row: TransferRow;
  deltas: BalanceDelta[];
}

export async function commitRange(
  chainId: number,
  items: IndexedTransfer[],
  lastIndexedBlock: number,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { row, deltas } of items) {
      const res = await client.query(
        `INSERT INTO transfers
          (chain_id, token, "from", "to", amount_handle, amount_clear, decrypt_status, block_number, block_timestamp, tx_hash, log_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
        [
          row.chainId,
          row.token.toLowerCase(),
          row.from.toLowerCase(),
          row.to.toLowerCase(),
          row.amountHandle.toLowerCase(),
          row.amountClear === null ? null : row.amountClear.toString(),
          row.decryptStatus,
          row.blockNumber.toString(),
          row.blockTimestamp.toString(),
          row.transactionHash.toLowerCase(),
          row.logIndex,
        ],
      );
      if (res.rowCount === 1) {
        await applyDeltas(client, chainId, row.token, deltas, row.blockNumber);
      }
    }
    await client.query(
      `INSERT INTO indexer_status
        (chain_id, last_indexed_block)
      VALUES ($1, $2)
      ON CONFLICT (chain_id) DO UPDATE SET last_indexed_block = EXCLUDED.last_indexed_block`,
      [chainId, lastIndexedBlock],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface PendingTransfer {
  chainId: number;
  transactionHash: string;
  logIndex: number;
  from: string;
  to: string;
  token: string;
  amountHandle: string;
  decryptStatus: DecryptStatus;
  blockNumber: bigint;
}

// TODO: Add pagination
export async function getPendingByParty(
  chainId: number,
  party: string,
): Promise<PendingTransfer[]> {
  const p = party.toLowerCase();
  const { rows } = await pool.query(
    `SELECT chain_id, tx_hash, log_index, "from", "to", token, amount_handle, decrypt_status, block_number
     FROM transfers
     WHERE chain_id = $1 AND decrypt_status = 'PENDING' AND ("from" = $2 OR "to" = $2)`,
    [chainId, p],
  );
  return rows.map((r) => ({
    chainId: r.chain_id,
    transactionHash: r.tx_hash,
    logIndex: r.log_index,
    from: r.from,
    to: r.to,
    token: r.token,
    amountHandle: r.amount_handle,
    decryptStatus: r.decrypt_status as DecryptStatus,
    blockNumber: BigInt(r.block_number),
  }));
}

export async function commitBackfill(
  chainId: number,
  row: PendingTransfer,
  amountClear: bigint,
  deltas: BalanceDelta[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE transfers
          SET decrypt_status = 'DECRYPTED', amount_clear = $4
        WHERE chain_id = $1 AND tx_hash = $2 AND log_index = $3`,
      [row.chainId, row.transactionHash.toLowerCase(), row.logIndex, amountClear.toString()],
    );
    if (deltas.length > 0) {
      await applyDeltas(client, chainId, row.token, deltas, row.blockNumber);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
