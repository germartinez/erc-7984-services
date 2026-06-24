import { config } from '@/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: config.db.url });

export const prisma = new PrismaClient({ adapter });
