import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { Discussion } from '../models/Discussion.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.use(authenticate);

const PAGE_SIZE = 15;
const CATEGORIES = [
  'Interview Experience',
  'Referrals',
  'Resume Review',
  'Salary',
  'General',
];

router.get('/', async (req, res, next) => {
  try {
    const { q, category, sort = 'recent', page = 1 } = req.query;

    const filter = {};
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (q?.trim()) filter.$text = { $search: q.trim() };

    const pageNum = Math.max(1, Number(page) || 1);
    const sortSpec = sort === 'top' ? { createdAt: -1 } : { createdAt: -1 };

    const [posts, total] = await Promise.all([
      Discussion.find(filter)
        .sort(sortSpec)
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean({ virtuals: true }),
      Discussion.countDocuments(filter),
    ]);

    // "Top" ranks by engagement, which Mongo cannot sort on without an extra field.
    const shaped = posts
      .map((p) => ({
        ...p,
        upvoteCount: p.upvotes?.length || 0,
        replyCount: p.replies?.length || 0,
        hasUpvoted: (p.upvotes || []).some((id) => String(id) === String(req.userId)),
        isOwner: String(p.authorId) === String(req.userId),
        upvotes: undefined,
        replies: undefined,
      }))
      .sort((a, b) => (sort === 'top' ? b.upvoteCount - a.upvoteCount : 0));

    res.json({
      success: true,
      posts: shaped,
      categories: CATEGORIES,
      page: pageNum,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const post = await Discussion.findById(req.params.id).lean();
    if (!post) throw new AppError('Discussion not found.', 404);

    res.json({
      success: true,
      post: {
        ...post,
        upvoteCount: post.upvotes?.length || 0,
        hasUpvoted: (post.upvotes || []).some((id) => String(id) === String(req.userId)),
        isOwner: String(post.authorId) === String(req.userId),
        replies: (post.replies || []).map((r) => ({
          ...r,
          upvoteCount: r.upvotes?.length || 0,
          isOwner: String(r.authorId) === String(req.userId),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, body, category, tags } = req.body;
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('Title and body are required.', 422);
    }

    const post = await Discussion.create({
      authorId: req.userId,
      authorName: req.user?.name || req.user?.email?.split('@')[0] || 'Member',
      title: title.trim(),
      body: body.trim(),
      category: CATEGORIES.includes(category) ? category : 'General',
      tags: Array.isArray(tags)
        ? tags.slice(0, 5)
        : String(tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 5),
    });

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, body, category, tags } = req.body;
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('Title and body are required.', 422);
    }

    const post = await Discussion.findOneAndUpdate(
      { _id: req.params.id, authorId: req.userId },
      {
        $set: {
          title: title.trim(),
          body: body.trim(),
          category: CATEGORIES.includes(category) ? category : 'General',
          tags: Array.isArray(tags)
            ? tags.slice(0, 5)
            : String(tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 5),
        },
      },
      { new: true },
    );

    if (!post) throw new AppError('Post not found or not yours to edit.', 404);
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/replies', async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) throw new AppError('Reply cannot be empty.', 422);

    const post = await Discussion.findById(req.params.id);
    if (!post) throw new AppError('Discussion not found.', 404);

    post.replies.push({
      authorId: req.userId,
      authorName: req.user?.name || req.user?.email?.split('@')[0] || 'Member',
      body: body.trim(),
    });
    await post.save();

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/replies/:replyId', async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) throw new AppError('Reply cannot be empty.', 422);

    const post = await Discussion.findById(req.params.id);
    if (!post) throw new AppError('Discussion not found.', 404);

    const reply = post.replies.id(req.params.replyId);
    if (!reply || String(reply.authorId) !== String(req.userId)) {
      throw new AppError('Reply not found or not yours to edit.', 404);
    }

    reply.body = body.trim();
    await post.save();
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/replies/:replyId', async (req, res, next) => {
  try {
    const post = await Discussion.findById(req.params.id);
    if (!post) throw new AppError('Discussion not found.', 404);

    const reply = post.replies.id(req.params.replyId);
    if (!reply || String(reply.authorId) !== String(req.userId)) {
      throw new AppError('Reply not found or not yours to delete.', 404);
    }

    reply.deleteOne();
    await post.save();
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

/** Upvotes are stored as user ids, so this toggles rather than increments. */
router.post('/:id/upvote', async (req, res, next) => {
  try {
    const post = await Discussion.findById(req.params.id);
    if (!post) throw new AppError('Discussion not found.', 404);

    const idx = post.upvotes.findIndex((id) => String(id) === String(req.userId));
    if (idx === -1) post.upvotes.push(req.userId);
    else post.upvotes.splice(idx, 1);

    await post.save();
    res.json({ success: true, upvoteCount: post.upvotes.length, hasUpvoted: idx === -1 });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { deletedCount } = await Discussion.deleteOne({
      _id: req.params.id,
      authorId: req.userId,
    });
    if (!deletedCount) throw new AppError('Post not found or not yours to delete.', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
