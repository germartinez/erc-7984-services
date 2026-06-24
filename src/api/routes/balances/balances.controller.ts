import type { ValidatedRequest } from '@/api/middlewares/validate';
import type { Response } from 'express';
import { BalancesParams } from './balances.model';
import { getBalance as getBalanceFromDB } from './balances.repository';

// api/v1/balances/:chainId/:address/:tokenAddress
export async function getBalance(
  req: ValidatedRequest<BalancesParams>,
  res: Response,
): Promise<void> {
  const { chainId, address, tokenAddress } = req.validated.params;

  const balance = await getBalanceFromDB(chainId, address, tokenAddress);

  res.status(200).json(balance);
}
