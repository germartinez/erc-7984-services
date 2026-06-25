import { prisma } from '@/db/client';
import type { TransferItem } from './transactions.model';

export async function getTransfers(
  chainId: number,
  address: string,
  limit: number,
  offset: number,
): Promise<TransferItem[]> {
  const addr = address.toLowerCase();

  const rows = await prisma.transfers.findMany({
    where: {
      chainId,
      OR: [{ fromAddress: addr }, { toAddress: addr }],
    },
    orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
    take: limit,
    skip: offset,
  });

  return rows.map((r) => ({
    chainId: r.chainId,
    transactionHash: r.txHash,
    from: r.fromAddress,
    to: r.toAddress,
    amount: r.amountClear === null ? null : r.amountClear.toFixed(0),
    decryptStatus: r.decryptStatus,
    blockNumber: Number(r.blockNumber),
    blockTimestamp: Number(r.blockTimestamp),
  }));
}
