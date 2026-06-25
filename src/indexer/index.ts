import { config } from '@/config';
import type { Address, Hex } from 'viem';
import { closeDb, commitBackfill, getLastBlockIndexed, getPendingByParty } from './lib/db';
import { fetchRange, getHeight } from './lib/envio';
import { applyOutcome, balanceDeltas, processTransfers } from './lib/utils';
import { tryDecrypt } from './lib/zama';

const FINALITY_BLOCKS = 5;
const POLL_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = true;

async function backfillDelegations(chainId: number, delegators: Address[]): Promise<void> {
  for (const delegator of new Set(delegators)) {
    const pending = await getPendingByParty(chainId, delegator);
    for (const row of pending) {
      const outcome = await tryDecrypt(row.amountHandle as Hex);
      const { decryptStatus, amountClear } = applyOutcome(outcome);

      if (decryptStatus !== 'DECRYPTED' || amountClear === null) {
        continue;
      }

      const deltas = balanceDeltas(
        { from: row.from as Address, to: row.to as Address },
        amountClear,
        'PENDING',
        'DECRYPTED',
      );
      await commitBackfill(chainId, row, amountClear, deltas);
      console.log(`[backfill] ${row.transactionHash}-${row.logIndex}: PENDING => DECRYPTED`);
    }
  }
}

async function runIndexer(): Promise<void> {
  const chainId = config.chain.id;
  const lastBlockIndexed = await getLastBlockIndexed(chainId);
  let fromBlock = lastBlockIndexed === undefined ? config.token.startBlock : lastBlockIndexed + 1;
  console.log(`[indexer] starting from block ${fromBlock} (lastBlockIndexed=${lastBlockIndexed})`);

  while (running) {
    const height = await getHeight();
    const safeHead = height - FINALITY_BLOCKS;
    if (safeHead < fromBlock) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    console.log(`[indexer] fetching blocks ${fromBlock} to ${safeHead + 1}`);

    const { transfers, delegators, nextBlock } = await fetchRange(fromBlock, safeHead + 1);

    console.log(
      `[indexer] fetched ${transfers.length} transfer(s) and ${delegators.length} delegator(s)`,
    );

    const committed = await processTransfers(chainId, transfers, nextBlock - 1);
    if (committed > 0) {
      console.log(`[indexer] committed ${committed} transfer(s) up to block ${nextBlock - 1}`);
    }

    if (delegators.length > 0) {
      // TODO: Add delegator to a queue. An independent process will read the queue and backfill the delegations.
      await backfillDelegations(chainId, delegators);
    }

    fromBlock = nextBlock;
    if (nextBlock > safeHead) await sleep(POLL_INTERVAL_MS);
  }
}

async function main(): Promise<void> {
  const shutdown = () => {
    running = false;
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await runIndexer();
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error('[indexer] fatal:', err);
  process.exitCode = 1;
});
