import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { getWorkerRedis } from '../queues/connection.js';
import { processEmailJob } from './email.processor.js';
import { logger } from '../utils/logger.js';

/** @type {import('bullmq').Worker | null} */
let worker = null;

/**
 * Worker limiter: ~1 job per second globally for this queue (adjust per provider tier).
 */
export function startEmailWorker() {
  if (worker) return worker;

  worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getWorkerRedis(),
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
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

  logger.info('BullMQ email worker started (1 email / sec limiter, concurrency 1)');
  return worker;
}

export async function stopEmailWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info('BullMQ email worker stopped');
}
