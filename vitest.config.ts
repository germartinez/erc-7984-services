import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(dir, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Dummy values so `src/config.ts` parses at import time. The DB is pg-mem and
    // the Zama SDK is mocked, so these are never used to reach a real service.
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      RPC_URL_SEPOLIA: 'http://localhost:8545',
      HYPERSYNC_URL: 'http://localhost:1234',
      HYPERSYNC_API_TOKEN: 'test-token',
      TOKEN_ADDRESS: '0x00000000000000000000000000000000000000ff',
      INDEXER_HOLDER_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    },
  },
});
