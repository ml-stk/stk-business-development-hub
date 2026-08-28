import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

const metaEnv = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'stk-business-development-hub.firebaseapp.com',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || 'stk-business-development-hub',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'stk-business-development-hub.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '607604777123',
  appId: metaEnv.VITE_FIREBASE_APP_ID || '1:607604777123:web:289ed08de65ab969501f16',
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Authentication using the existing project
export const auth = getAuth(app);

// Named Cloud Firestore database ID: stk-bizdev-hub-uat
// Centrally configured via Vite environment variable VITE_FIREBASE_DATABASE_ID
export const configuredDatabaseId: string =
  metaEnv.VITE_FIREBASE_DATABASE_ID ||
  'stk-bizdev-hub-uat';

if (!configuredDatabaseId) {
  throw new Error(
    'CRITICAL CONFIGURATION ERROR: VITE_FIREBASE_DATABASE_ID is missing. ' +
    'The application requires an explicit named Firestore database ID (e.g. stk-bizdev-hub-uat).'
  );
}

// Development-safe diagnostic log (never logs API keys or credentials)
if (metaEnv.DEV || metaEnv.MODE === 'development') {
  console.info(
    `[Firebase Diagnostic] Cloud Firestore connected to named database: "${configuredDatabaseId}" in project: "${firebaseConfig.projectId}"`
  );
}

// Central Cloud Firestore instance bound strictly to the named database
export const db = initializeFirestore(
  app,
  {},
  configuredDatabaseId
);

// Connection test helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'connection-test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline or connecting.');
    }
    return false;
  }
}
