import { config } from '@/config';
import { HypersyncClient, type Log, type Query } from '@envio-dev/hypersync-client';
import { encodeEventTopics, type Address, type Hex } from 'viem';
import { aclAbi, erc7984Abi } from '../abis/erc7984';
import type { RawTransfer } from './utils';
import { aclAddress, holderAddress } from './zama';

const TRANSFER_TOPIC0 = encodeEventTopics({
  abi: erc7984Abi,
  eventName: 'ConfidentialTransfer',
})[0];

const DELEGATED_TOPICS: string[][] = encodeEventTopics({
  abi: aclAbi,
  eventName: 'DelegatedForUserDecryption',
  args: { delegate: holderAddress },
}).map((t) => (t === null ? [] : Array.isArray(t) ? t : [t]));

const token = config.token.address;
const tokenLower = token.toLowerCase();
const aclLower = aclAddress.toLowerCase();
const client = new HypersyncClient({ url: config.envio.url, apiToken: config.envio.apiToken });

export interface LogBatch {
  transfers: RawTransfer[];
  delegators: Address[];
  nextBlock: number;
}

export function getHeight(): Promise<number> {
  return client.getHeight();
}

export async function fetchRange(fromBlock: number, toBlock: number): Promise<LogBatch> {
  const query: Query = {
    fromBlock,
    toBlock,
    logs: [
      { address: [token], topics: [[TRANSFER_TOPIC0]] },
      { address: [aclAddress], topics: DELEGATED_TOPICS },
    ],
    fieldSelection: {
      log: [
        'Address',
        'Data',
        'LogIndex',
        'TransactionHash',
        'BlockNumber',
        'Topic0',
        'Topic1',
        'Topic2',
        'Topic3',
      ],
      block: ['Number', 'Timestamp'],
    },
  };

  const res = await client.get(query);

  const blockTs = new Map<number, bigint>();
  for (const b of res.data.blocks) {
    if (b.number !== undefined && b.timestamp !== undefined) {
      blockTs.set(b.number, BigInt(b.timestamp));
    }
  }

  const transfers: RawTransfer[] = [];
  const delegators: Address[] = [];
  for (const log of res.data.logs) {
    const address = log.address?.toLowerCase();
    if (address === tokenLower) {
      const raw = decodeTransfer(log, blockTs);
      if (raw) {
        transfers.push(raw);
      }
    } else if (address === aclLower) {
      const delegator = decodeDelegator(log);
      if (delegator) {
        delegators.push(delegator);
      }
    }
  }

  return { transfers, delegators, nextBlock: res.nextBlock };
}

function decodeTransfer(log: Log, blockTs: Map<number, bigint>): RawTransfer | undefined {
  const [, from, to, handle] = log.topics;
  if (
    !from ||
    !to ||
    !handle ||
    log.blockNumber === undefined ||
    log.logIndex === undefined ||
    !log.transactionHash
  ) {
    return;
  }
  return {
    chainId: config.chain.id,
    token,
    from: `0x${from.slice(26)}` as Address,
    to: `0x${to.slice(26)}` as Address,
    amountHandle: handle as Hex,
    blockNumber: BigInt(log.blockNumber),
    blockTimestamp: blockTs.get(log.blockNumber) ?? 0n,
    transactionHash: log.transactionHash as Hex,
    logIndex: log.logIndex,
  };
}

function decodeDelegator(log: Log): Address | undefined {
  const delegatorTopic = log.topics[1];
  if (!delegatorTopic || !log.data || log.data.length < 66) {
    return;
  }
  const contractAddress = `0x${log.data.slice(26, 66)}`.toLowerCase();
  if (contractAddress !== tokenLower) {
    return;
  }
  return `0x${delegatorTopic.slice(26)}` as Address;
}
