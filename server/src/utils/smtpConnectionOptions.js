import { env } from '../config/env.js';

/**
 * Nodemailer SMTP socket timeouts (shared: Gmail path + .env SMTP_HOST path).
 */
export function getSmtpConnectionOptions() {
  const c = env.email.smtpConnection;
  return {
    connectionTimeout: c.connectionTimeoutMs,
    greetingTimeout: c.greetingTimeoutMs,
    socketTimeout: c.socketTimeoutMs,
  };
}
