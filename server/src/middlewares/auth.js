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
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: { firebaseUid: decoded.uid, isVerified: Boolean(decoded.email_verified) },
        $setOnInsert: { email, name: decoded.name || '' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    req.userId = user._id.toString();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
