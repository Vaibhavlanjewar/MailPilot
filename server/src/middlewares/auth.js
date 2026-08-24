import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { verifyFirebaseToken } from '../services/firebase/firebase.service.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  let decoded;
  try {
    decoded = await verifyFirebaseToken(header.slice(7));
  } catch (err) {
    if (err.message === 'Firebase Admin is not configured') {
      return next(new AppError('Authentication service unavailable', 503));
    }
    return next(new AppError('Invalid or expired token', 401));
  }

  const email = decoded.email?.trim().toLowerCase();
  if (!email) {
    return next(new AppError('Token is missing an email claim', 401));
  }

  try {
    const user = await findOrCreateUser(email, decoded);
    req.userId = user._id.toString();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * firebaseUid carries a unique index (see models/User.js), so a blind
 * findOneAndUpdate-by-email upsert can throw an unhandled duplicate-key error
 * whenever that uid already sits on a *different* email's document — e.g. the
 * same Firebase account's email changed, or a stale record from an earlier
 * sign-in attempt. That crash previously surfaced as a raw 500 on the very
 * first authenticated request after login. Resolving by firebaseUid first
 * keeps that as a normal update instead.
 */
async function findOrCreateUser(email, decoded) {
  const update = {
    $set: { firebaseUid: decoded.uid, isVerified: Boolean(decoded.email_verified) },
  };

  try {
    return await User.findOneAndUpdate(
      { email },
      { ...update, $setOnInsert: { email, name: decoded.name || '' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  // The email-based upsert lost a unique-index race on firebaseUid — that uid
  // already belongs to a different document. Treat it as the same account and
  // move its email forward instead of leaving it permanently unreachable by
  // the identity Firebase now reports for it.
  const existing = await User.findOneAndUpdate(
    { firebaseUid: decoded.uid },
    { $set: { ...update.$set, email } },
    { new: true },
  );
  if (existing) return existing;

  // Lost the race the other way (another request just created the email doc
  // first) — it now has the uid we wanted, so just re-fetch it.
  const byEmail = await User.findOne({ email });
  if (byEmail) return byEmail;

  throw new AppError('Could not resolve account for this login.', 500);
}
