import { MockInterviewRoom } from '../../models/MockInterviewRoom.js';
import { User } from '../../models/User.js';
import { getMeetingReminderQueue } from '../../queues/meetingReminder.queue.js';
import { sendCampaignMail } from '../email/campaignSend.js';
import { resolveCampaignFrom } from '../../utils/mailFrom.js';
import { joinUrlFor } from './meetingInvite.js';
import { logger } from '../../utils/logger.js';

const REMIND_BEFORE_MS = 10 * 60 * 1000;

/** Stable id so rescheduling replaces the pending reminder instead of adding one. BullMQ rejects ':' in custom ids. */
function jobIdFor(code) {
  return `meeting-reminder-${code}`;
}

/**
 * NOTE: on Render's free tier the instance sleeps after ~15 minutes idle, and a
 * sleeping process runs no BullMQ timers — a reminder scheduled while asleep
 * fires whenever the service next wakes, not on time. Keeping the instance warm
 * (an external uptime pinger on /api/health) is what makes this punctual.
 */
export async function scheduleMeetingReminder(room) {
  if (!room.scheduledAt || room.status === 'cancelled') return false;

  const delay = new Date(room.scheduledAt).getTime() - REMIND_BEFORE_MS - Date.now();
  if (delay <= 0) return false; // starting too soon to be worth reminding

  try {
    const queue = getMeetingReminderQueue();
    await cancelMeetingReminder(room.code);
    await queue.add(
      'remind',
      { code: room.code },
      { jobId: jobIdFor(room.code), delay, removeOnComplete: true, attempts: 2 },
    );
    return true;
  } catch (err) {
    // A missing reminder must never block scheduling — the invite already went out.
    logger.warn('Could not schedule meeting reminder', { code: room.code, error: err.message });
    return false;
  }
}

export async function cancelMeetingReminder(code) {
  try {
    const job = await getMeetingReminderQueue().getJob(jobIdFor(code));
    if (job) await job.remove();
    return true;
  } catch (err) {
    logger.warn('Could not cancel meeting reminder', { code, error: err.message });
    return false;
  }
}

function reminderHtml({ room, url, minutes }) {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px">
      <h2 style="margin:0 0 8px">Starting in ${minutes} minutes</h2>
      <p style="margin:0 0 20px;color:#475569">${room.title || 'Your mock interview'} is about to begin.</p>
      <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Join now
      </a>
      <p style="margin:20px 0 0;font-size:13px;color:#94a3b8">Or paste this link: ${url}</p>
    </div>
  `;
}

/** @param {import('bullmq').Job<{ code: string }>} job */
export async function processMeetingReminderJob(job) {
  const { code } = job.data;
  const room = await MockInterviewRoom.findOne({ code });
  if (!room || room.status === 'cancelled' || room.status === 'ended') return;

  const host = await User.findById(room.createdBy)
    .select('+gmailRefreshTokenEnc email name smtpUser smtpFromDisplayName')
    .lean();
  if (!host) return;

  const url = joinUrlFor(code);
  const from = resolveCampaignFrom(host);
  const minutes = Math.max(1, Math.round((new Date(room.scheduledAt).getTime() - Date.now()) / 60000));
  const html = reminderHtml({ room, url, minutes });
  const text = `${room.title || 'Your mock interview'} starts in ${minutes} minutes.\n\nJoin: ${url}\n`;
  const subject = `Starting soon: ${room.title || 'mock interview'}`;

  // Both sides get the nudge; one failing shouldn't stop the other.
  const recipients = [host.email, room.inviteeEmail].filter(Boolean);
  for (const to of recipients) {
    try {
      await sendCampaignMail(host, { to, subject, html, text, from });
    } catch (err) {
      logger.warn('Meeting reminder send failed', { code, to, error: err.message });
    }
  }
}
