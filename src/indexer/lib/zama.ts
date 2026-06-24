import { config } from '@/config';
import {
  DecryptionFailedError,
  sepolia as fheSepolia,
  MemoryStorage,
  NoCiphertextError,
  ZamaSDK,
} from '@zama-fhe/sdk';
import { node } from '@zama-fhe/sdk/node';
import { createConfig } from '@zama-fhe/sdk/viem';
import { createPublicClient, createWalletClient, http, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia as viemSepolia } from 'viem/chains';
import { aclAbi } from '../abis/erc7984';

export type DecryptOutcome =
  | { kind: 'decrypted'; value: bigint }
  | { kind: 'pending'; reason: string }
  | { kind: 'failed'; reason: string };

const account = privateKeyToAccount(config.indexer.privateKey);
const transport = http(config.chain.rpcUrl);

const publicClient = createPublicClient({ chain: viemSepolia, transport }) as PublicClient;
const walletClient = createWalletClient({ account, chain: viemSepolia, transport });

const sdk = new ZamaSDK(
  createConfig({
    chains: [fheSepolia],
    publicClient,
    walletClient,
    relayers: { [fheSepolia.id]: node() },
    storage: new MemoryStorage(),
  }),
);

export const holderAddress = account.address;
export const aclAddress = fheSepolia.aclContractAddress;

export async function isEntitled(handle: Hex): Promise<boolean> {
  return publicClient.readContract({
    address: aclAddress,
    abi: aclAbi,
    functionName: 'isAllowed',
    args: [handle, holderAddress],
  });
}

export async function tryDecrypt(handle: Hex): Promise<DecryptOutcome> {
  let entitled: boolean;
  try {
    entitled = await isEntitled(handle);
  } catch (err) {
    return { kind: 'failed', reason: `acl-read: ${errMessage(err)}` };
  }
  if (!entitled) {
    return { kind: 'pending', reason: 'holder not entitled (ACL isAllowed=false)' };
  }

  try {
    const result = await sdk.decryption.decryptValues([
      { encryptedValue: handle, contractAddress: config.token.address },
    ]);
    const value = result[handle];
    if (value === undefined) {
      return { kind: 'failed', reason: 'relayer returned no value for handle' };
    }
    return { kind: 'decrypted', value: BigInt(value as bigint | string) };
  } catch (err) {
    if (err instanceof NoCiphertextError) {
      return { kind: 'pending', reason: 'no ciphertext available yet' };
    }
    if (err instanceof DecryptionFailedError) {
      return { kind: 'failed', reason: `decrypt: ${errMessage(err)}` };
    }
    return { kind: 'failed', reason: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
