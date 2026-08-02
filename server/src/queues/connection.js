import net from 'net';
import Redis from 'ioredis';
import { env } from '../config/env.js';

function checkTcpOpen(host, port, ms = 5000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.setTimeout(ms);
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }));
    });
  });
}

/**
 * Fails fast with a clear message if Redis is down (avoids endless ECONNREFUSED spam).
 */
export async function verifyRedisConnection() {
  try {
    await checkTcpOpen(env.redis.host, env.redis.port);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    const base = `Redis unreachable at ${env.redis.host}:${env.redis.port}`;
    const hint =
      code === 'ECONNREFUSED'
        ? ' Nothing is listening (Redis is not running or wrong port). Start Redis, or from the project root run: npm run docker:up'
        : '';
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${base}.${hint} [${code || 'error'}] ${detail}`);
  }

  const client = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    tls: env.redis.tls ? {} : undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  client.on('error', () => {});

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      throw new Error(`Unexpected Redis PING reply: ${pong}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Redis TCP is open but protocol/auth failed at ${env.redis.host}:${env.redis.port}: ${detail}`
    );
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/**
 * BullMQ requires maxRetriesPerRequest: null on the ioredis client.
 * Use a dedicated connection per Queue/Worker to avoid blocking issues.
 */
export function createRedisConnection() {
  return new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    tls: env.redis.tls ? {} : undefined,
    maxRetriesPerRequest: null,
  });
}

let sharedForQueue;
export function getQueueRedis() {
  if (!sharedForQueue) sharedForQueue = createRedisConnection();
  return sharedForQueue;
}

let sharedForWorker;
export function getWorkerRedis() {
  if (!sharedForWorker) sharedForWorker = createRedisConnection();
  return sharedForWorker;
}

export async function closeRedisConnections() {
  await Promise.all([
    sharedForQueue?.quit().catch(() => {}),
    sharedForWorker?.quit().catch(() => {}),
  ]);
  sharedForQueue = undefined;
  sharedForWorker = undefined;
}
