// Firebase *client* initialization (Auth/Firestore/Storage).
// Intended for usage from Client Components only.
"use client";

import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from "firebase/app";
import { type Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function missingFirebaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!firebaseConfig.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!firebaseConfig.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  // These aren’t required for Auth, but are needed for other products:
  if (!firebaseConfig.storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!firebaseConfig.messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  return missing;
}

/** True if all required env vars are set (Firebase can be initialized). */
export function isFirebaseConfigured(): boolean {
  return missingFirebaseEnvVars().length === 0;
}

function initFirebaseApp(): FirebaseApp {
  const missing = missingFirebaseEnvVars();
  if (missing.length) {
    throw new Error(`Firebase is not configured. Missing: ${missing.join(", ")}`);
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
}

// --- Canonical instances (no tenant / custom-domain configuration) ---
export const app: FirebaseApp = initFirebaseApp();

// Per your requirement: getAuth(app)
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirestoreDb(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

/**
 * Analytics is optional and only works in the browser (and not all environments).
 * Call this from a Client Component effect (e.g. useEffect) when you actually need analytics.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | undefined> {
  if (typeof window === "undefined") return undefined;
  return (await isSupported()) ? getAnalytics(app) : undefined;
}

