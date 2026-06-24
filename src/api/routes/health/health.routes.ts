import { asyncHandler } from '@/api/middlewares/async-handler';
import { Router } from 'express';
import { getHealth } from './health.controller';

const router = Router();

router.get('/', asyncHandler(getHealth));

export default router;
