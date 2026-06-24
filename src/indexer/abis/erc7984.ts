export const erc7984Abi = [
  {
    type: 'event',
    name: 'ConfidentialTransfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'bytes32', indexed: true },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

export const aclAbi = [
  {
    type: 'function',
    name: 'isAllowed',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'DelegatedForUserDecryption',
    inputs: [
      { name: 'delegator', type: 'address', indexed: true },
      { name: 'delegate', type: 'address', indexed: true },
      { name: 'contractAddress', type: 'address', indexed: false },
      { name: 'delegationCounter', type: 'uint64', indexed: false },
      { name: 'oldExpirationDate', type: 'uint64', indexed: false },
      { name: 'newExpirationDate', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
] as const;
