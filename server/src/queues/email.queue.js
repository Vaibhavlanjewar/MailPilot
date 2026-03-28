import { Queue } from 'bullmq';
import { getQueueRedis } from './connection.js';

export const EMAIL_QUEUE_NAME = 'bulk-email';

let queueInstance;

export function getEmailQueue() {
  if (!queueInstance) {
    queueInstance = new Queue(EMAIL_QUEUE_NAME, {
      connection: getQueueRedis(),
    });
  }
  return queueInstance;
}

export async function closeEmailQueue() {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
