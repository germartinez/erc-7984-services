import type { Address, Hex } from 'viem';
import { zeroAddress } from 'viem';
import { commitRange } from './db';
import type { DecryptOutcome } from './zama';
import { tryDecryptAs } from './zama';

export type DecryptStatus = 'DECRYPTED' | 'PENDING';

export interface RawTransfer {
  chainId: number;
  token: Address;
  from: Address;
  to: Address;
  amountHandle: Hex;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: Hex;
  logIndex: number;
}

export interface TransferRow extends RawTransfer {
  amountClear: bigint | null;
  decryptStatus: DecryptStatus;
}

export function applyOutcome(outcome: DecryptOutcome): {
  decryptStatus: DecryptStatus;
  amountClear: bigint | null;
} {
  return outcome.kind === 'decrypted'
    ? { decryptStatus: 'DECRYPTED', amountClear: outcome.value }
    : { decryptStatus: 'PENDING', amountClear: null };
}

export function buildTransferRow(raw: RawTransfer, outcome: DecryptOutcome): TransferRow {
  const { decryptStatus, amountClear } = applyOutcome(outcome);
  return { ...raw, amountClear, decryptStatus };
}

export interface BalanceDelta {
  address: Address;
  net: bigint;
}

export function balanceDeltas(
  raw: Pick<RawTransfer, 'from' | 'to'>,
  amount: bigint,
  oldStatus: DecryptStatus | 'NONE',
  newStatus: DecryptStatus,
): BalanceDelta[] {
  const becameDecrypted = newStatus === 'DECRYPTED' && oldStatus !== 'DECRYPTED';
  if (!becameDecrypted) return [];

  const deltas: BalanceDelta[] = [];
  const sides: Array<{ address: Address; sign: bigint }> = [
    { address: raw.from, sign: -1n },
    { address: raw.to, sign: 1n },
  ];
  for (const { address, sign } of sides) {
    if (address.toLowerCase() === zeroAddress) continue;
    deltas.push({ address, net: sign * amount });
  }
  return deltas;
}

async function decryptForTransfer(raw: RawTransfer): Promise<DecryptOutcome> {
  let outcome: DecryptOutcome = { kind: 'pending', reason: 'no delegating party' };
  for (const party of [raw.from, raw.to]) {
    if (party.toLowerCase() === zeroAddress) continue;
    outcome = await tryDecryptAs(raw.amountHandle, party);
    if (outcome.kind === 'decrypted') break;
  }
  return outcome;
}

export async function processTransfers(
  chainId: number,
  transfers: RawTransfer[],
  lastIndexedBlock: number,
): Promise<number> {
  const items = [];
  for (const raw of transfers) {
    const outcome = await decryptForTransfer(raw);
    const row = buildTransferRow(raw, outcome);
    const deltas = balanceDeltas(raw, row.amountClear ?? 0n, 'NONE', row.decryptStatus);
    items.push({ row, deltas });
  }
  await commitRange(chainId, items, lastIndexedBlock);
  return items.length;
}
