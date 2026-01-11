
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) throw new Error('Firebase service account key is not set in environment variables.');
    
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount))
    });
  } catch (e: any) {
    console.error("Firebase Admin initialization error:", e.message);
  }
}

export default admin;
