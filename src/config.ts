import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  API_PORT: z.coerce.number().min(1),
  DATABASE_URL: z.string().min(1),
});

const env = envSchema.parse(process.env);

export const config = {
  api: {
    port: env.API_PORT,
  },
  db: {
    url: env.DATABASE_URL,
  },
};
