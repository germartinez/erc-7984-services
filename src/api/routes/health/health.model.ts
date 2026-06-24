export type ChainHealthStatus = {
  chainId: number;
  lastIndexedBlock?: number;
  chainHead?: number;
  blocksBehind?: number;
  ready: boolean;
};
