import mongoose from 'mongoose';
import { Template } from '../models/Template.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export async function listTemplates(req, res, next) {
  try {
    const templates = await Template.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req, res, next) {
  try {
    const { name, subject, body = '', textContent = '' } = req.body;

    const template = await Template.create({
      userId: req.userId,
      name,
      subject,
      body,
      textContent,
    });

    logger.info('Template created', { templateId: template._id });

    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('Invalid template id', 400);
    }

    const result = await Template.deleteOne({ _id: id, userId: req.userId });

    if (result.deletedCount === 0) {
      throw new AppError('Template not found', 404);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
