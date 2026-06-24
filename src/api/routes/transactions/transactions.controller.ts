import type { ValidatedRequest } from '@/api/middlewares/validate';
import type { Response } from 'express';
import { TransactionsParams, TransactionsQuery } from './transactions.model';
import { getTransfers as getTransfersFromDB } from './transactions.repository';

// api/v1/transactions/:chainId/:address?limit&offset
export async function getTransfers(
  req: ValidatedRequest<TransactionsParams, TransactionsQuery>,
  res: Response,
): Promise<void> {
  const { chainId, address } = req.validated.params;
  const { limit, offset } = req.validated.query;

  const transactions = await getTransfersFromDB(chainId, address, limit, offset);

  res.status(200).json({
    chainId,
    address: address.toLowerCase(),
    limit,
    offset,
    count: transactions.length,
    transactions,
  });
}
