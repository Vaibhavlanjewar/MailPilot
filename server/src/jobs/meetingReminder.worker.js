import { Worker } from 'bullmq';
import { MEETING_REMINDER_QUEUE_NAME } from '../queues/meetingReminder.queue.js';
import { getWorkerRedis } from '../queues/connection.js';
import { processMeetingReminderJob } from '../services/mockInterview/meetingReminder.js';
import { logger } from '../utils/logger.js';

/** @type {import('bullmq').Worker | null} */
let worker = null;

/**
 * Reminders are a trickle (two emails, ten minutes before a meeting), so this
 * needs none of the throttling the bulk campaign worker has.
 */
export function startMeetingReminderWorker() {
  if (worker) return worker;

  worker = new Worker(MEETING_REMINDER_QUEUE_NAME, processMeetingReminderJob, {
    connection: getWorkerRedis(),
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    logger.error('Meeting reminder job failed', { jobId: job?.id, reason: err?.message });
  });

  logger.info('BullMQ meeting reminder worker started');
  return worker;
}

export async function stopMeetingReminderWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info('BullMQ meeting reminder worker stopped');
}
