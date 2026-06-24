import { prisma } from '@/db/client';
import type { Address } from 'viem';
import type { BalanceResponse } from './balances.model';

export async function getBalance(
  chainId: number,
  address: string,
  tokenAddress: string,
): Promise<BalanceResponse> {
  const addr = address.toLowerCase() as Address;
  const token = tokenAddress.toLowerCase() as Address;

  const row = await prisma.balances.findUnique({
    where: { chainId_token_address: { chainId, token, address: addr } },
  });

  return {
    chainId,
    address: addr,
    token,
    cleartextBalance: row ? row.netDecrypted.toFixed(0) : null,
    lastBlock: row ? Number(row.lastBlock) : 0,
  };
}
