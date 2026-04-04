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
    const seenEmails = new Set();
    const seenNames = new Set();
    const duplicatePayloadEmails = new Set();
    const duplicatePayloadNames = new Set();
    const normalized = [];

    for (const c of contacts) {
      const raw =
        typeof c?.email === 'string' ? c.email.trim().toLowerCase() : '';
      if (!raw || !validator.isEmail(raw)) continue;

      if (seenEmails.has(raw)) {
        duplicatePayloadEmails.add(raw);
        continue;
      }
      seenEmails.add(raw);

      const name = typeof c?.name === 'string' ? c.name.trim() : '';
      const company = typeof c?.company === 'string' ? c.company.trim() : '';

      if (name) {
        const normalizedName = name.toLowerCase();
        if (seenNames.has(normalizedName)) {
          duplicatePayloadNames.add(name);
          continue;
        }
        seenNames.add(normalizedName);
      }

      normalized.push({ email: raw, name, company });
    }

    if (!normalized.length) {
      throw new AppError('No valid email addresses in contacts', 400);
    }

    if (duplicatePayloadEmails.size || duplicatePayloadNames.size) {
      const parts = [];
      if (duplicatePayloadNames.size) {
        parts.push(`Duplicate names in request: ${Array.from(duplicatePayloadNames).join(', ')}`);
      }
      if (duplicatePayloadEmails.size) {
        parts.push(`Duplicate emails in request: ${Array.from(duplicatePayloadEmails).join(', ')}`);
      }
      throw new AppError(parts.join('. '), 409);
    }

    const normalizedEmails = normalized.map((row) => row.email);
    const normalizedNames = normalized
      .map((row) => (typeof row.name === 'string' ? row.name.trim().toLowerCase() : ''))
      .filter(Boolean);

    const existingByEmail = await Contact.find({
      userId,
      email: { $in: normalizedEmails },
    })
      .select('email')
      .lean();

    const existingByName = normalizedNames.length
      ? await Contact.find({
          userId,
          name: { $exists: true, $ne: '' },
        })
          .select('name')
          .lean()
      : [];

    const existingEmailSet = new Set(
      existingByEmail.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean),
    );
    const existingNameSet = new Set(
      existingByName.map((row) => String(row.name || '').trim().toLowerCase()).filter(Boolean),
    );

    const duplicateExistingEmails = normalizedEmails.filter((email) => existingEmailSet.has(email));
    const duplicateExistingNames = normalizedNames.filter((name) => existingNameSet.has(name));

    if (duplicateExistingEmails.length || duplicateExistingNames.length) {
      const parts = [];
      if (duplicateExistingNames.length) {
        parts.push(`Name already present in client list: ${Array.from(new Set(duplicateExistingNames)).join(', ')}`);
      }
      if (duplicateExistingEmails.length) {
        parts.push(`Email already present in client list: ${Array.from(new Set(duplicateExistingEmails)).join(', ')}`);
      }
      throw new AppError(parts.join('. '), 409);
    }

    const ops = normalized.map((row) => ({
      updateOne: {
        filter: { userId, email: row.email },
        update: {
          ...((row.name || row.company)
            ? {
                $set: {
                  ...(row.name ? { name: row.name } : {}),
                  ...(row.company ? { company: row.company } : {}),
                },
              }
            : {}),
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
        company: c.company || '',
        subscribed: c.subscribed !== false,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateContactSubscription(req, res, next) {
  try {
    const { subscribed } = req.body;
    if (typeof subscribed !== 'boolean') {
      throw new AppError('subscribed must be a boolean', 422);
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { subscribed } },
      { new: true },
    ).lean();

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    res.json({
      contact: {
        id: contact._id.toString(),
        email: contact.email,
        name: contact.name || '',
        company: contact.company || '',
        subscribed: contact.subscribed !== false,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req, res, next) {
  try {
    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
    const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email');
    const hasCompany = Object.prototype.hasOwnProperty.call(req.body || {}, 'company');

    const rawName = hasName && typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawEmail = hasEmail && typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawCompany = hasCompany && typeof req.body?.company === 'string' ? req.body.company.trim() : '';

    if (!hasName && !hasEmail && !hasCompany) {
      throw new AppError('At least one contact field is required', 400);
    }

    const contactId = req.params.id;
    const existing = await Contact.findOne({ _id: contactId, userId: req.userId }).lean();
    if (!existing) {
      throw new AppError('Contact not found', 404);
    }

    if (hasEmail && !validator.isEmail(rawEmail)) {
      throw new AppError('email must be a valid email address', 422);
    }

    if (hasEmail && rawEmail !== String(existing.email || '').trim().toLowerCase()) {
      const emailCollision = await Contact.findOne({
        _id: { $ne: contactId },
        userId: req.userId,
        email: rawEmail,
      })
        .select('_id')
        .lean();

      if (emailCollision) {
        throw new AppError('Email already present in client list', 409);
      }
    }

    if (hasName && rawName) {
      const normalizedName = rawName.toLowerCase();
      const nameCollision = await Contact.findOne({
        _id: { $ne: contactId },
        userId: req.userId,
        name: { $exists: true, $ne: '' },
      })
        .select('name')
        .lean();

      if (
        nameCollision &&
        String(nameCollision.name || '').trim().toLowerCase() === normalizedName
      ) {
        throw new AppError('Name already present in client list', 409);
      }
    }

    const update = {
      ...(hasEmail ? { email: rawEmail } : {}),
      ...(hasName ? { name: rawName } : {}),
      ...(hasCompany ? { company: rawCompany } : {}),
    };

    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, userId: req.userId },
      { $set: update },
      { new: true },
    ).lean();

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    res.json({
      contact: {
        id: contact._id.toString(),
        email: contact.email,
        name: contact.name || '',
        company: contact.company || '',
        subscribed: contact.subscribed !== false,
      },
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
          ...((row.name || row.company)
            ? {
                $set: {
                  ...(row.name ? { name: row.name } : {}),
                  ...(row.company ? { company: row.company } : {}),
                },
              }
            : {}),
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
