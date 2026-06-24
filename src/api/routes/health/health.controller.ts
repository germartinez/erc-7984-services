import type { ValidatedRequest } from '@/api/middlewares/validate';
import type { Response } from 'express';
import { getChainHealthStatus } from './health.repository';

// api/v1/health
export async function getHealth(
  _req: ValidatedRequest<unknown, unknown>,
  res: Response,
): Promise<void> {
  const status = await getChainHealthStatus();

  res.status(200).json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    status,
  });
}
