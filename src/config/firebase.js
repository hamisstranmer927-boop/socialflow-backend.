const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK.
 * Falls back to JWT-based auth if Firebase is not configured.
 */
function initializeFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  // Check if Firebase is configured
  if (!projectId || projectId === 'your-firebase-project-id') {
    console.log('⚠️  Firebase not configured. Using JWT fallback auth.');
    return null;
  }

  try {
    // Try loading service account file
    const fullPath = path.resolve(serviceAccountPath);
    if (fs.existsSync(fullPath)) {
      const serviceAccount = require(fullPath);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log('✅ Firebase Admin SDK initialized.');
    } else {
      // Use application default credentials
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      console.log('✅ Firebase initialized with default credentials.');
    }
  } catch (error) {
    console.error('⚠️  Firebase init failed:', error.message);
    console.log('⚠️  Falling back to JWT auth.');
  }

  return firebaseApp;
}

/**
 * Verify a Firebase ID token
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<object>} Decoded token
 */
async function verifyFirebaseToken(idToken) {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { initializeFirebase, verifyFirebaseToken, getApp: () => firebaseApp };
