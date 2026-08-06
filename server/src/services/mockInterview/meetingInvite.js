import { env } from '../../config/env.js';
import { User } from '../../models/User.js';
import { sendCampaignMail } from '../email/campaignSend.js';
import { resolveCampaignFrom } from '../../utils/mailFrom.js';
import { logger } from '../../utils/logger.js';

/** RFC 5545 wants UTC basic format: 20260812T143000Z */
function toIcsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Long lines must be folded at 75 octets with a leading space on continuations,
 * or strict parsers (Outlook especially) reject the event.
 */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function joinUrlFor(code) {
  const base = String(env.frontendUrl || '').replace(/\/$/, '');
  return `${base}/app/mock-interview/${code}`;
}

/**
 * A minimal but valid VEVENT. METHOD:REQUEST plus the text/calendar part is
 * what makes Gmail render the "RSVP" card instead of a bare file attachment.
 */
export function buildIcs({ room, organizerEmail, organizerName, attendeeEmail }) {
  const start = new Date(room.scheduledAt);
  const end = new Date(start.getTime() + room.durationMinutes * 60 * 1000);
  const url = joinUrlFor(room.code);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MailPilot//Mock Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:mailpilot-${room.code}@mailpilot`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText(room.title || 'Mock interview')}`,
    `DESCRIPTION:${escapeIcsText(`Join the practice room:\n${url}`)}`,
    `URL:${url}`,
    `LOCATION:${escapeIcsText(url)}`,
    `ORGANIZER;CN=${escapeIcsText(organizerName || organizerEmail)}:mailto:${organizerEmail}`,
    attendeeEmail
      ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`
      : null,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mock interview starts in 10 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

function inviteHtml({ hostName, room, url, when }) {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px">
      <h2 style="margin:0 0 8px">${escapeHtml(room.title || 'Mock interview')}</h2>
      <p style="margin:0 0 16px;color:#475569">
        ${escapeHtml(hostName)} invited you to a 1:1 practice interview on MailPilot.
      </p>
      <table style="border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">When</td><td style="padding:4px 0"><strong>${escapeHtml(when)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Duration</td><td style="padding:4px 0">${room.durationMinutes} minutes</td></tr>
      </table>
      <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Join the room
      </a>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b">
        The room opens 10 minutes before the start time. You'll need to allow camera and microphone access.
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8">Or paste this link: ${url}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Renders the start time in the host's words; recipients' clients localise the .ics itself. */
function formatWhen(date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date) + ' UTC';
}

/**
 * Best-effort: a failed invite must never roll back a scheduled meeting, since
 * the host still has a shareable link. Returns whether the email went out.
 */
export async function sendMeetingInvite(room) {
  if (!room.inviteeEmail) return { sent: false, reason: 'no invitee' };

  const host = await User.findById(room.createdBy)
    .select('+gmailRefreshTokenEnc email name smtpUser smtpFromDisplayName')
    .lean();
  if (!host) return { sent: false, reason: 'host not found' };

  const url = joinUrlFor(room.code);
  const when = formatWhen(new Date(room.scheduledAt));
  const from = resolveCampaignFrom(host);
  const organizerEmail = host.smtpUser || host.email;
  const hostName = host.name || organizerEmail.split('@')[0];

  const ics = buildIcs({
    room,
    organizerEmail,
    organizerName: hostName,
    attendeeEmail: room.inviteeEmail,
  });

  try {
    const result = await sendCampaignMail(host, {
      to: room.inviteeEmail,
      subject: `Mock interview: ${room.title || 'practice session'} — ${when}`,
      html: inviteHtml({ hostName, room, url, when }),
      text: `${hostName} invited you to a mock interview.\n\nWhen: ${when}\nDuration: ${room.durationMinutes} minutes\nJoin: ${url}\n`,
      from,
      attachments: [
        {
          filename: 'invite.ics',
          content: Buffer.from(ics, 'utf8'),
          contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
        },
      ],
    });
    logger.info('Mock interview invite sent', { code: room.code, messageId: result.messageId });
    return { sent: true };
  } catch (err) {
    // Most common cause: the host hasn't connected Gmail yet.
    logger.warn('Mock interview invite could not be sent', {
      code: room.code,
      error: err.message,
    });
    return { sent: false, reason: err.message };
  }
}
