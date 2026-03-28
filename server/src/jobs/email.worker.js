import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { getWorkerRedis } from '../queues/connection.js';
import { processEmailJob } from './email.processor.js';
import { logger } from '../utils/logger.js';

/** @type {import('bullmq').Worker | null} */
let worker = null;

/**
 * Rate limit + concurrency from env (defaults: 1 job/sec, concurrency 1).
 * Raise EMAIL_RATE_LIMIT_MAX only if your SMTP provider allows higher throughput.
 */
export function startEmailWorker() {
  if (worker) return worker;

  const { concurrency, rateLimitMax, rateLimitDurationMs } = env.emailWorker;

  worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getWorkerRedis(),
    concurrency,
    limiter: {
      max: rateLimitMax,
      duration: rateLimitDurationMs,
    },
  });

  worker.on('completed', (job) => {
    logger.debug('Job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', {
      jobId: job?.id,
      reason: err?.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  logger.info('BullMQ email worker started', {
    concurrency,
    rateLimitMax,
    rateLimitDurationMs,
  });
  return worker;
}

export async function stopEmailWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info('BullMQ email worker stopped');
}
