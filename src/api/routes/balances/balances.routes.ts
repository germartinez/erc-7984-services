import { asyncHandler } from '@/api/middlewares/async-handler';
import { validate } from '@/api/middlewares/validate';
import { Router } from 'express';
import { getBalance } from './balances.controller';
import { balancesParamsSchema } from './balances.model';

const router = Router();

// api/v1/balances/:chainId/:address/:tokenAddress
router.get(
  '/:chainId/:address/:tokenAddress',
  validate({ params: balancesParamsSchema }),
  asyncHandler(getBalance),
);

export default router;
