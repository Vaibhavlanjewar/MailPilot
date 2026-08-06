import http from 'http';
import app from './app.js';
import { assertEnv, env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startEmailWorker, stopEmailWorker } from './jobs/email.worker.js';
import {
  startMeetingReminderWorker,
  stopMeetingReminderWorker,
} from './jobs/meetingReminder.worker.js';
import { closeEmailQueue } from './queues/email.queue.js';
import { closeMeetingReminderQueue } from './queues/meetingReminder.queue.js';
import { closeRedisConnections, verifyRedisConnection } from './queues/connection.js';
import { getFirebaseAdmin } from './services/firebase/firebase.service.js';
import { attachSignalingServer } from './services/mockInterview/signaling.js';
import { logger } from './utils/logger.js';

assertEnv();
await connectDatabase();

if (!getFirebaseAdmin()) {
  const message =
    'Firebase Admin not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY. All authenticated routes will return 503.';
  if (env.nodeEnv === 'production') {
    logger.error(message);
    process.exit(1);
  }
  logger.warn(message);
}

try {
  await verifyRedisConnection();
  logger.info(`Redis OK (${env.redis.host}:${env.redis.port})`);
} catch (e) {
  logger.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

if (env.runEmailWorker) {
  startEmailWorker();
  startMeetingReminderWorker();
} else {
  logger.info('RUN_EMAIL_WORKER=false — start a worker via `npm run worker`');
}

const server = http.createServer(app);
attachSignalingServer(server);

server.listen(env.port, () => {
  logger.info(`HTTP server listening on port ${env.port}`);
});

async function shutdown(signal) {
  try {
    logger.info(`${signal} received, closing gracefully`);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await stopEmailWorker();
    await stopMeetingReminderWorker();
    await closeEmailQueue();
    await closeMeetingReminderQueue();
    await closeRedisConnections();
    await disconnectDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (e) {
    logger.error('Shutdown error', { err: e.message });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

