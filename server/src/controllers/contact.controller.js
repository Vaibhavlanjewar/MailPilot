import mongoose from 'mongoose';
import validator from 'validator';
import { Contact } from '../models/Contact.js';
import { AppError } from '../utils/AppError.js';
import { parseContactsCsv } from '../utils/csvParser.js';
import { logger } from '../utils/logger.js';

export async function bulkContacts(req, res, next) {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new AppError('contacts must be a non-empty array', 400);
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const seen = new Set();
    const normalized = [];

    for (const c of contacts) {
      const raw =
        typeof c?.email === 'string' ? c.email.trim().toLowerCase() : '';
      if (!raw || !validator.isEmail(raw) || seen.has(raw)) continue;
      seen.add(raw);
      const name = typeof c?.name === 'string' ? c.name.trim() : '';
      normalized.push({ email: raw, name });
    }

    if (!normalized.length) {
      throw new AppError('No valid email addresses in contacts', 400);
    }

    const ops = normalized.map((row) => ({
      updateOne: {
        filter: { userId, email: row.email },
        update: {
          $set: { name: row.name || '' },
          $setOnInsert: { userId, email: row.email },
        },
        upsert: true,
      },
    }));

    await Contact.bulkWrite(ops, { ordered: false });

    const emails = normalized.map((n) => n.email);
    const docs = await Contact.find({ userId, email: { $in: emails } })
      .select('_id email')
      .lean();

    logger.info('Contacts bulk upsert', {
      userId: req.userId,
      count: docs.length,
    });

    res.status(201).json({
      contactIds: docs.map((d) => d._id.toString()),
      count: docs.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function listContacts(req, res, next) {
  try {
    const list = await Contact.find({ userId: req.userId })
      .sort({ email: 1 })
      .lean();

    res.json({
      contacts: list.map((c) => ({
        id: c._id.toString(),
        email: c.email,
        name: c.name || '',
        subscribed: true,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadContacts(req, res, next) {
  try {
    if (!req.file?.buffer) {
      throw new AppError('CSV file is required (field name: file)', 400);
    }

    const rows = parseContactsCsv(req.file.buffer);
    const userId = new mongoose.Types.ObjectId(req.userId);

    const ops = rows.map((row) => ({
      updateOne: {
        filter: { userId, email: row.email },
        update: {
          $set: { name: row.name || '' },
          $setOnInsert: { userId, email: row.email },
        },
        upsert: true,
      },
    }));

    await Contact.bulkWrite(ops, { ordered: false });

    const count = await Contact.countDocuments({ userId: req.userId });

    logger.info('Contacts CSV imported', { userId, imported: rows.length, total: count });

    res.status(201).json({
      message: 'Contacts imported',
      imported: rows.length,
      totalContacts: count,
    });
  } catch (err) {
    next(err);
  }
}
