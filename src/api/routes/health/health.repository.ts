import { config } from '@/config';
import { prisma } from '@/db/client';
import { createPublicClient, http } from 'viem';
import { ChainHealthStatus } from './health.model';

const READY_THRESHOLD = 5;

const client = createPublicClient({ transport: http(config.chain.rpcUrl) });

async function getLastIndexedBlock(chainId: number): Promise<number | undefined> {
  const row = await prisma.indexerStatus.findUnique({
    where: { chainId },
  });
  return row ? Number(row.lastIndexedBlock) : undefined;
}

async function getChainHead(): Promise<number | undefined> {
  try {
    return Number(await client.getBlockNumber());
  } catch {
    return;
  }
}

export async function getChainHealthStatus(): Promise<ChainHealthStatus[]> {
  const chainId = config.chain.id;
  const [lastIndexedBlock, chainHead] = await Promise.all([
    getLastIndexedBlock(chainId),
    getChainHead(),
  ]);

  const blocksBehind =
    chainHead !== undefined && lastIndexedBlock !== undefined
      ? Math.max(0, chainHead - lastIndexedBlock)
      : undefined;

  return [
    {
      chainId,
      lastIndexedBlock,
      chainHead,
      blocksBehind,
      ready: blocksBehind !== undefined && blocksBehind <= READY_THRESHOLD,
    },
  ];
}
