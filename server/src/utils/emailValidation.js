import dns from "node:dns/promises";
import validator from "validator";

const DNS_TIMEOUT_MS = 5000;

/**
 * What this can and can't prove.
 *
 * True per-mailbox verification needs either an SMTP RCPT TO handshake or a
 * paid third-party API (ZeroBounce, NeverBounce, ...) — and this app already
 * runs on Render, which blocks outbound SMTP entirely (the same reason
 * campaign sending goes through the Gmail API instead of raw SMTP). RCPT TO
 * probing is simply not deployable here.
 *
 * A DNS-level domain check is: does this domain have anywhere to deliver mail
 * at all. That reliably catches genuinely dead/unregistered domains (a made-up
 * TLD, an expired employer domain with no DNS left at all) but has two
 * verified false-positive gaps worth knowing about, not just a hypothetical
 * disclaimer:
 *
 *  1. A fake local part at a real, live domain always passes —
 *     "totally-fake-user-12345@gmail.com" resolves fine, because gmail.com
 *     itself resolves fine. Checkable without SMTP access, period.
 *  2. A parked or typo-squatted domain can still pass. Verified directly:
 *     gmial.com (a common gmail.com typo) has no MX record at all, but does
 *     have a live A record (a parking page). Per RFC 5321 §5.1, a domain
 *     with no MX falls back to its A/AAAA record for delivery — real SMTP
 *     relays honor that fallback too, so rejecting it here would mean
 *     rejecting some legitimately-configured small domains that only ever
 *     set an A record and never bothered adding an explicit MX. That
 *     trade-off is deliberate: falsely blocking a real recruiter's email is
 *     worse for this product's actual goal than occasionally letting a
 *     parked-domain typo through, which the send attempt itself will still
 *     eventually fail on anyway.
 */

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), ms)),
  ]);
}

/**
 * @param {string} domain
 * @returns {Promise<boolean>} whether the domain has anywhere to receive mail
 */
async function domainHasMailServer(domain) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx?.length) return true;
  } catch {
    // ENODATA/ENOTFOUND for MX specifically isn't fatal — RFC 5321 §5.1 allows
    // falling back to a domain's A/AAAA record when no MX exists.
  }

  try {
    const a4 = await withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS);
    if (a4?.length) return true;
  } catch {
    // fall through to AAAA
  }

  try {
    const a6 = await withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS);
    return Boolean(a6?.length);
  } catch {
    return false;
  }
}

/**
 * @param {string} email
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
export async function validateRecipientEmail(email) {
  const trimmed = String(email || "").trim();

  if (!trimmed || !validator.isEmail(trimmed)) {
    return { valid: false, reason: "Invalid email address" };
  }

  const domain = trimmed.split("@")[1];
  const hasMailServer = await domainHasMailServer(domain).catch(() => false);
  if (!hasMailServer) {
    return { valid: false, reason: `Domain "${domain}" has no mail server` };
  }

  return { valid: true, reason: "" };
}
