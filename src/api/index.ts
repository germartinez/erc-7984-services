import { config } from '@/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ApiError, globalErrorHandler } from './middlewares/error-handler';
import balancesRoutes from './routes/balances/balances.routes';
import healthRoutes from './routes/health/health.routes';
import transactionsRoutes from './routes/transactions/transactions.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/balances', balancesRoutes);
app.use('/api/v1/transactions', transactionsRoutes);

// Error handlers
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const error = new ApiError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found`);
  next(error);
});
app.use(globalErrorHandler);

const server = app.listen(config.api.port, () => {
  console.info(`HTTP server listening on port ${config.api.port}`);
});

function shutdown(sig: string) {
  console.log(`${sig} received, shutting down...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
