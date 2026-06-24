import cors from 'cors';
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';

const app = express();

const PORT = process.env.API_PORT;

export const server = app.listen(PORT, () => {
  console.info(`HTTP server listening on port ${PORT}`);
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
