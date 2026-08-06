import { Queue } from 'bullmq';
import { getQueueRedis } from './connection.js';

export const MEETING_REMINDER_QUEUE_NAME = 'meeting-reminder';

let queueInstance;

export function getMeetingReminderQueue() {
  if (!queueInstance) {
    queueInstance = new Queue(MEETING_REMINDER_QUEUE_NAME, {
      connection: getQueueRedis(),
    });
  }
  return queueInstance;
}

export async function closeMeetingReminderQueue() {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
