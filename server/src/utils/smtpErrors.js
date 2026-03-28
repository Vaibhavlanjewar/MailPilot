/**
 * Enrich stored SMTP errors with short operational hints (Mongo EmailLog.error).
 * @param {unknown} err
 * @returns {string}
 */
export function formatEmailSendErrorForLog(err) {
  const message = err instanceof Error ? err.message : String(err);
  const m = message.trim() || 'Unknown error';

  if (/connection timeout/i.test(m) || /\bETIMEDOUT\b/i.test(m)) {
    return `${m} — Often: cloud/host blocks outbound SMTP (587/465). Try port 465 + TLS, another network, or an HTTP email API (e.g. SES/Resend).`;
  }

  if (/ECONNREFUSED/i.test(m)) {
    return `${m} — Refused at host:port — check SMTP_HOST, SMTP_PORT, and firewall.`;
  }

  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) {
    return `${m} — DNS lookup failed — check SMTP_HOST spelling and resolver.`;
  }

  return m;
}
