import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '../../config/env.js';

let app = null;

export function getFirebaseAdmin() {
  if (app) return app;
  
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }
  
  if (!env.firebase.privateKey || !env.firebase.projectId) {
    console.warn("Firebase credentials missing, firebase service is running mock store mode.");
    return null;
  }
  
  try {
    app = initializeApp({
      credential: cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey
      })
    });
    console.log("Firebase Admin initialized successfully.");
    return app;
  } catch (err) {
    console.error("Firebase admin init error:", err);
    return null;
  }
}

// Get Firestore DB reference
export function getFirestoreDB() {
  const adminApp = getFirebaseAdmin();
  if (!adminApp) return null;
  try {
    return getFirestore(adminApp);
  } catch (err) {
    console.error("Firebase Firestore get db error:", err);
    return null;
  }
}

// Local mock backing fallback if firebase keys are invalid (local-first resilience)
const localFallbackResumes = new Map();

export async function saveUserResumeToFirebase(userId, resumeData) {
  const db = getFirestoreDB();
  const resumeId = resumeData.id || `res-${Math.floor(1000 + Math.random() * 9000)}`;
  const entry = { ...resumeData, id: resumeId, userId, updatedAt: new Date().toISOString() };

  if (!db) {
    console.warn("Using offline mock persistence for saveUserResumeToFirebase");
    if (!localFallbackResumes.has(userId)) {
      localFallbackResumes.set(userId, []);
    }
    const current = localFallbackResumes.get(userId).filter(r => r.id !== resumeId);
    current.unshift(entry);
    localFallbackResumes.set(userId, current);
    return entry;
  }

  try {
    const docRef = db.collection('resumes').doc(resumeId);
    await docRef.set(entry);
    return entry;
  } catch (err) {
    console.error("Firebase Firestore save error, falling back to local fallback store:", err);
    if (!localFallbackResumes.has(userId)) {
      localFallbackResumes.set(userId, []);
    }
    const current = localFallbackResumes.get(userId).filter(r => r.id !== resumeId);
    current.unshift(entry);
    localFallbackResumes.set(userId, current);
    return entry;
  }
}

export async function getUserResumesFromFirebase(userId) {
  const db = getFirestoreDB();
  if (!db) {
    console.warn("Using offline mock persistence for getUserResumesFromFirebase");
    return localFallbackResumes.get(userId) || [];
  }

  try {
    const snapshot = await db.collection('resumes')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const results = [];
    snapshot.forEach(doc => {
      results.push(doc.data());
    });
    return results;
  } catch (err) {
    console.error("Firebase Firestore query error, falling back to local fallback store:", err);
    // fallback to blank if DB query crashes (e.g. database indexing is building)
    return localFallbackResumes.get(userId) || [];
  }
}

export async function deleteUserResumeFromFirebase(userId, resumeId) {
  const db = getFirestoreDB();
  if (!db) {
    console.warn("Using offline mock persistence for deleteUserResumeFromFirebase");
    if (localFallbackResumes.has(userId)) {
      const current = localFallbackResumes.get(userId).filter(r => r.id !== resumeId);
      localFallbackResumes.set(userId, current);
    }
    return true;
  }

  try {
    const docRef = db.collection('resumes').doc(resumeId);
    const doc = await docRef.get();
    if (doc.exists && doc.data().userId === userId) {
      await docRef.delete();
      return true;
    }
    return false;
  } catch (err) {
    console.error("Firebase Firestore delete error, falling back to local fallback store:", err);
    if (localFallbackResumes.has(userId)) {
      const current = localFallbackResumes.get(userId).filter(r => r.id !== resumeId);
      localFallbackResumes.set(userId, current);
    }
    return true;
  }
}
