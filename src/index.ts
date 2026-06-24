import { server } from '@/api';

async function main(): Promise<void> {
  console.info(`ERC-7984 Services`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

function shutdown(sig: string) {
  console.info(`${sig} received, shutting down...`);
  server.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
