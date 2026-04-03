import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.js';
import { EmailLog } from '../models/EmailLog.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parsePage(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_PAGE), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE;
  return parsed;
}

function toSearchRegex(search) {
  if (!search) return null;
  const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe ? new RegExp(safe, 'i') : null;
}

function getSortStage(sort) {
  const sortBy = String(sort || 'recently-opened');
  if (sortBy === 'most-opened') {
    return { openCount: -1, recentlyOpenedAt: -1, updatedAt: -1 };
  }
  if (sortBy === 'not-opened') {
    return { opened: 1, recentlyOpenedAt: -1, updatedAt: -1 };
  }
  return { recentlyOpenedAt: -1, updatedAt: -1 };
}

function sendPixel(res) {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', String(TRACKING_PIXEL_GIF.length));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).end(TRACKING_PIXEL_GIF);
}

export async function trackEmailOpen(req, res) {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return sendPixel(res);

    const decoded = jwt.verify(token, env.jwt.secret);
    const emailLogId = decoded?.emailLogId;
    if (!emailLogId || !mongoose.isValidObjectId(emailLogId)) {
      return sendPixel(res);
    }

    const now = new Date();

    await EmailLog.updateOne(
      { _id: emailLogId },
      {
        $set: {
          opened: true,
          recentlyOpenedAt: now,
        },
        $inc: { openCount: 1 },
        $push: { openHistory: now },
      },
    );
  } catch (_err) {
    // Intentionally swallow tracking errors and always return pixel.
  }

  return sendPixel(res);
}

export async function getEmailTracking(req, res, next) {
  try {
    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const campaignId = req.query.campaignId ? String(req.query.campaignId).trim() : '';
    const searchRegex = toSearchRegex(req.query.search);

    const campaigns = await Campaign.find({ userId: req.userId })
      .select('_id name')
      .sort({ updatedAt: -1 })
      .lean();

    if (!campaigns.length) {
      return res.json({
        items: [],
        campaigns: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const campaignIds = campaigns.map((c) => c._id);
    const campaignMap = new Map(campaigns.map((c) => [String(c._id), c.name]));

    let scopedCampaignIds = campaignIds;
    if (campaignId) {
      if (!mongoose.isValidObjectId(campaignId)) {
        throw new AppError('Invalid campaignId', 400);
      }
      const exists = campaignMap.has(campaignId);
      if (!exists) {
        return res.json({
          items: [],
          campaigns: campaigns.map((c) => ({ id: String(c._id), name: c.name })),
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: page > 1,
          },
        });
      }
      scopedCampaignIds = [new mongoose.Types.ObjectId(campaignId)];
    }

    const basePipeline = [
      { $match: { campaignId: { $in: scopedCampaignIds } } },
      {
        $lookup: {
          from: 'contacts',
          localField: 'contactId',
          foreignField: '_id',
          as: 'contact',
        },
      },
      {
        $addFields: {
          contactName: { $ifNull: [{ $arrayElemAt: ['$contact.name', 0] }, ''] },
          contactEmail: {
            $ifNull: [{ $arrayElemAt: ['$contact.email', 0] }, '$toEmail'],
          },
        },
      },
    ];

    if (searchRegex) {
      basePipeline.push({
        $match: {
          $or: [{ contactName: searchRegex }, { contactEmail: searchRegex }],
        },
      });
    }

    const sortStage = getSortStage(req.query.sort);

    const [result] = await EmailLog.aggregate([
      ...basePipeline,
      { $sort: sortStage },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                campaignId: 1,
                opened: 1,
                openCount: 1,
                recentlyOpenedAt: 1,
                contactName: 1,
                contactEmail: 1,
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const total = result?.total?.[0]?.count || 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const items = (result?.items || []).map((row) => ({
      id: String(row._id),
      campaignId: String(row.campaignId),
      campaignName: campaignMap.get(String(row.campaignId)) || 'Campaign',
      opened: Boolean(row.opened),
      openCount: Number(row.openCount || 0),
      recentlyOpenedAt: row.recentlyOpenedAt || null,
      name: row.contactName || '',
      email: row.contactEmail || '',
      createdAt: row.createdAt || null,
    }));

    res.json({
      items,
      campaigns: campaigns.map((c) => ({ id: String(c._id), name: c.name })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}
