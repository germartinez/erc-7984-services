import { z } from 'zod';

export type TransferItem = {
  chainId: number;
  transactionHash: string;
  from: string;
  to: string;
  amount: string | null;
  decryptStatus: string;
  blockNumber: number;
  blockTimestamp: number;
};

const chainIdSchema = z.preprocess((val) => {
  if (typeof val === 'string' && val.length > 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }
  return val;
}, z.number().int().positive());

export const transactionsParamsSchema = z.object({
  chainId: chainIdSchema,
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
});

export type TransactionsParams = z.infer<typeof transactionsParamsSchema>;

const intFromQuery = (def: number, min: number, max: number) =>
  z.preprocess((val) => {
    if (val === undefined || val === '') return def;
    if (typeof val === 'string') {
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    }
    return val;
  }, z.number().int().min(min).max(max));

export const transactionsQuerySchema = z.object({
  limit: intFromQuery(50, 1, 200),
  offset: intFromQuery(0, 0, Number.MAX_SAFE_INTEGER),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
