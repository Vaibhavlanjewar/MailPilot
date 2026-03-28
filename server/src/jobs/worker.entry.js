/**
 * Standalone worker process for horizontal scaling (run multiple instances).
 * Usage: npm run worker (from server package)
 */
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { assertEnv, env } from '../config/env.js';
import { startEmailWorker, stopEmailWorker } from './email.worker.js';
import { closeEmailQueue } from '../queues/email.queue.js';
import { closeRedisConnections, verifyRedisConnection } from '../queues/connection.js';
import { logger } from '../utils/logger.js';

assertEnv();

await connectDatabase();

try {
  await verifyRedisConnection();
  logger.info(`Redis OK (${env.redis.host}:${env.redis.port})`);
} catch (e) {
  logger.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

startEmailWorker();

logger.info('Standalone worker running', {
  redis: `${env.redis.host}:${env.redis.port}`,
});

async function shutdown(signal) {
  logger.info(`${signal} — stopping worker`);
  await stopEmailWorker();
  await closeEmailQueue();
  await closeRedisConnections();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
