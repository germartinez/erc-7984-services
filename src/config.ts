import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  RPC_URL_SEPOLIA: z.url(),
  API_PORT: z.coerce.number().min(1).default(3000),
  HYPERSYNC_URL: z.url().min(1),
  HYPERSYNC_API_TOKEN: z.string().min(1),
  START_BLOCK: z.coerce.number().int().nonnegative().default(0),
  TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  INDEXER_HOLDER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key'),
});

const env = envSchema.parse(process.env);

export const config = {
  api: {
    port: env.API_PORT,
  },
  db: {
    url: env.DATABASE_URL,
  },
  chain: {
    id: env.CHAIN_ID,
    rpcUrl: env.RPC_URL_SEPOLIA,
  },
  envio: {
    url: env.HYPERSYNC_URL,
    apiToken: env.HYPERSYNC_API_TOKEN,
  },
  token: {
    address: env.TOKEN_ADDRESS as `0x${string}`,
    startBlock: env.START_BLOCK,
  },
  indexer: {
    privateKey: env.INDEXER_HOLDER_PRIVATE_KEY as `0x${string}`,
  },
};
