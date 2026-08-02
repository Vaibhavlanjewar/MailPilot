import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { getSmtpConnectionOptions } from '../../utils/smtpConnectionOptions.js';

export class NodemailerProvider {
  constructor() {
    const { host, port, secure, user, pass } = env.email.smtp;
    if (!host) {
      this._transport = null;
      logger.warn(
        'SMTP_HOST not set — configure .env to send real mail (Ethereal or your SMTP).'
      );
      return;
    }
    const hasAuth = Boolean(user && pass);
    if (
      /gmail\.com|googlemail\.com/i.test(host) &&
      !hasAuth
    ) {
      logger.warn(
        'SMTP_HOST looks like Gmail but SMTP_USER/SMTP_PASS are missing — sends will fail with 530 Authentication Required. Use an App Password (Google Account → Security) or a different SMTP.'
      );
    }
    const conn = getSmtpConnectionOptions();
    this._transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: hasAuth ? { user, pass } : undefined,
      ...conn,
      ...(port === 587 && !secure ? { requireTLS: true } : {}),
    });
  }

  /**
   * @param {{ name: string, send:(mail: object) => Promise<{ messageId: string }> }} [transport]
   */
  setTransport(transport) {
    this._transport = transport;
  }

  /**
   * @param {{ to: string, subject: string, html?: string, text?: string, from?: string | import('nodemailer').Address, replyTo?: string, attachments?: { filename: string, content: Buffer, contentType?: string }[] }} params
   */
  async send({ to, subject, html, text, from, replyTo, attachments }) {
    if (!this._transport) {
      throw new Error(
        'Email transport not configured. Set SMTP_HOST and related vars in .env'
      );
    }
    const info = await this._transport.sendMail({
      from: from ?? env.email.from,
      to,
      subject,
      html,
      text: text || undefined,
      ...(replyTo ? { replyTo } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
    return { messageId: info.messageId || '', response: info.response };
  }
}
