import { z } from 'zod';

export type BalanceResponse = {
  chainId: number;
  address: string;
  token: string;
  cleartextBalance: string | null;
  lastBlock: number;
};

const chainIdSchema = z.preprocess((val) => {
  if (typeof val === 'string' && val.length > 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }
  return val;
}, z.number().int().positive());

export const balancesParamsSchema = z.object({
  chainId: chainIdSchema,
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
});

export type BalancesParams = z.infer<typeof balancesParamsSchema>;
