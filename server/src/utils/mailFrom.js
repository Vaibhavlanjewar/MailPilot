import { env } from '../config/env.js';

/**
 * Campaign mail "From": uses Settings (smtpFromDisplayName + smtpUser) when set,
 * else account name + email. Falls back to EMAIL_FROM only if no owner email.
 *
 * @param {{ email?: string, name?: string, smtpUser?: string, smtpFromDisplayName?: string } | null | undefined} owner
 * @returns {string | { name: string, address: string }}
 */
export function resolveCampaignFrom(owner) {
  const accountEmail = owner?.email?.trim();
  const address =
    (owner?.smtpUser && String(owner.smtpUser).trim()) || accountEmail;
  if (!address) {
    return env.email.from;
  }
  const name =
    (owner?.smtpFromDisplayName && String(owner.smtpFromDisplayName).trim()) ||
    (owner?.name && String(owner.name).trim()) ||
    address.split('@')[0];
  return { name, address };
}
