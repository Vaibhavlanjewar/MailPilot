import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Amazon SES adapter stub — swap in `@aws-sdk/client-sesv2` in production.
 * Keeps the same `send()` contract as NodemailerProvider for interchangeability.
 */
export class SesEmailProvider {
  async send({ to, subject, html, text, from, replyTo }) {
    logger.debug('SES send stub', { to, subject, region: env.email.ses.region });
    throw new Error(
      'SES provider not wired: install @aws-sdk/client-sesv2 and implement SendEmailCommand in ses.provider.js'
    );
  }
}
