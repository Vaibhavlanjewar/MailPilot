import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.js';
import { EmailLog } from '../models/EmailLog.js';
import { Contact } from '../models/Contact.js';
import { AppError } from '../utils/AppError.js';
import { enqueueCampaignSend } from '../services/campaign.queue.service.js';
import { logger } from '../utils/logger.js';

export async function createCampaign(req, res, next) {
  try {
    const { name, subject, content, textContent = '', contactIds = [], scheduledAt } =
      req.body;

    let recipientContactIds = [];
    if (Array.isArray(contactIds) && contactIds.length) {
      for (const id of contactIds) {
        if (!mongoose.isValidObjectId(id)) {
          throw new AppError('Invalid contact id in contactIds', 400);
        }
      }
      const count = await Contact.countDocuments({
        _id: { $in: contactIds },
        userId: req.userId,
        subscribed: { $ne: false },
      });
      if (count !== contactIds.length) {
        throw new AppError('One or more contacts are invalid or disabled', 400);
      }
      recipientContactIds = contactIds;
    }

    let scheduledDate = null;
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new AppError('Invalid scheduledAt date', 400);
      }
    }

    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      subject,
      content,
      textContent,
      recipientContactIds,
      scheduledAt: scheduledDate,
      status: 'pending',
    });

    logger.info('Campaign created', { campaignId: campaign._id });

    res.status(201).json({ campaign });
  } catch (err) {
    next(err);
  }
}

export async function sendCampaign(req, res, next) {
  try {
    const { scheduledAt } = req.body || {};
    const campaign = await enqueueCampaignSend(req.params.id, req.userId, {
      scheduledAt,
    });
    res.json({
      message: 'Campaign queued for delivery',
      campaign,
    });
  } catch (err) {
    next(err);
  }
}

export async function listCampaigns(req, res, next) {
  try {
    const campaigns = await Campaign.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignStatus(req, res, next) {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const logs = await EmailLog.find({ campaignId: campaign._id })
      .sort({ createdAt: 1 })
      .select('contactId toEmail status error attempts lastAttemptAt providerMessageId createdAt updatedAt')
      .lean();

    const contactIds = logs
      .map((log) => log.contactId)
      .filter(Boolean);
    const contacts = contactIds.length
      ? await Contact.find({
          _id: { $in: contactIds },
          userId: req.userId,
        })
          .select('name email')
          .lean()
      : [];

    const contactMap = new Map(
      contacts.map((contact) => [String(contact._id), contact]),
    );

    const recipients = logs.map((log) => {
      const contact = log.contactId ? contactMap.get(String(log.contactId)) : null;
      return {
        ...log,
        name: contact?.name || '',
        email: contact?.email || log.toEmail,
      };
    });

    const summary = recipients.reduce(
      (acc, recipient) => {
        acc.total += 1;
        if (recipient.status === 'sent') acc.sent += 1;
        else if (recipient.status === 'failed') acc.failed += 1;
        else acc.queued += 1;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, queued: 0 },
    );

    res.json({
      campaign,
      summary,
      recipients,
    });
  } catch (err) {
    next(err);
  }
}
