import { config } from '@/config';
import {
  DecryptionFailedError,
  DelegationExpiredError,
  DelegationNotFoundError,
  DelegationNotPropagatedError,
  sepolia as fheSepolia,
  MemoryStorage,
  NoCiphertextError,
  ZamaSDK,
} from '@zama-fhe/sdk';
import { node } from '@zama-fhe/sdk/node';
import { createConfig } from '@zama-fhe/sdk/viem';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
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

export async function isDelegated(handle: Hex, delegator: Address): Promise<boolean> {
  return publicClient.readContract({
    address: aclAddress,
    abi: aclAbi,
    functionName: 'isHandleDelegatedForUserDecryption',
    args: [delegator, holderAddress, config.token.address, handle],
  });
}

export async function tryDecryptAs(handle: Hex, delegator: Address): Promise<DecryptOutcome> {
  let delegated: boolean;
  try {
    delegated = await isDelegated(handle, delegator);
  } catch (err) {
    return { kind: 'failed', reason: `acl-read: ${errMessage(err)}` };
  }
  if (!delegated) {
    return { kind: 'pending', reason: 'no active delegation to holder (ACL)' };
  }

  try {
    const result = await sdk.decryption.delegatedDecryptValues(
      [{ encryptedValue: handle, contractAddress: config.token.address }],
      delegator,
    );
    const value = result[handle];
    if (value === undefined) {
      return { kind: 'failed', reason: 'relayer returned no value for handle' };
    }
    return { kind: 'decrypted', value: BigInt(value as bigint | string) };
  } catch (err) {
    if (
      err instanceof DelegationNotFoundError ||
      err instanceof DelegationExpiredError ||
      err instanceof DelegationNotPropagatedError
    ) {
      return { kind: 'pending', reason: `no active delegation: ${errMessage(err)}` };
    }
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
