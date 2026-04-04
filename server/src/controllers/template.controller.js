import mongoose from 'mongoose';
import { Template } from '../models/Template.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { generateTemplateFromPrompt } from '../services/ai/templateAi.service.js';

const DEFAULT_TEMPLATE_NAME = 'Software Engineer Application';
const DEFAULT_TEMPLATE_SUBJECT = 'Application for Software Engineer Role at {{company}}';
const DEFAULT_TEMPLATE_BODY = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Application for Software Engineer Role</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Dear {{name}},</p>

  <p>
    I am writing to express my strong interest in a <strong>Software Engineer</strong> role at <strong>{{company}}</strong>.
    I bring hands-on experience building secure, scalable full-stack applications and solving practical engineering problems.
  </p>

  <p>
    I enjoy working across product and engineering teams to ship reliable features, improve performance,
    and maintain clean, maintainable code across the stack.
  </p>

  <h3>Technical Skills:</h3>
  <ul>
    <li><strong>Programming Languages:</strong> C, C++, Java, JavaScript, Python, Go</li>
    <li><strong>Frontend:</strong> HTML, CSS, React.js, Tailwind CSS</li>
    <li><strong>Backend:</strong> Node.js, Express.js, MongoDB, SQL</li>
    <li><strong>Other:</strong> Git, REST APIs, Docker, AWS</li>
  </ul>

  <h3>Projects:</h3>
  <ul>
    <li><strong>Collaborative Code Editor:</strong> Real-time editor using React, Socket.IO, and Node.js</li>
    <li><strong>Portfolio Platform:</strong> Responsive portfolio with email workflow integration</li>
    <li><strong>ML Predictor:</strong> Machine learning model for outcome prediction and analysis</li>
  </ul>

  <p>
    I have attached my resume for your review and would welcome the opportunity to contribute to your team.
  </p>

  <p>Thank you for your time and consideration.</p>

  <p>
    Best regards,<br />
    <strong>{{name}}</strong><br>
    MailPilot
  </p>
</body>
</html>`;

export async function listTemplates(req, res, next) {
  try {
    let templates = await Template.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .lean();

    if (!templates.length) {
      const template = await Template.create({
        userId: req.userId,
        name: DEFAULT_TEMPLATE_NAME,
        subject: DEFAULT_TEMPLATE_SUBJECT,
        body: DEFAULT_TEMPLATE_BODY,
      });
      templates = [template.toObject()];
    }

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

export async function generateTemplateAi(req, res, next) {
  try {
    const { prompt } = req.body;
    const generated = await generateTemplateFromPrompt(prompt);

    res.json({
      subject: generated.subject,
      body: generated.body,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('Invalid template id', 400);
    }

    const { name, subject, body = '', textContent = '' } = req.body;

    const template = await Template.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { name, subject, body, textContent },
      { new: true, runValidators: true }
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    logger.info('Template updated', { templateId: template._id });

    res.json({ template });
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
