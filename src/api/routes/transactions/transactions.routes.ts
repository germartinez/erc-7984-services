import { asyncHandler } from '@/api/middlewares/async-handler';
import { validate } from '@/api/middlewares/validate';
import { Router } from 'express';
import { getTransfers } from './transactions.controller';
import { transactionsParamsSchema, transactionsQuerySchema } from './transactions.model';

const router = Router();

// api/v1/transactions/:chainId/:address?limit&offset
router.get(
  '/:chainId/:address',
  validate({ params: transactionsParamsSchema, query: transactionsQuerySchema }),
  asyncHandler(getTransfers),
);

export default router;
