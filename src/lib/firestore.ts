// src/lib/firestore.ts
// Firestore helpers for Parker BOS. Use these with the db from @/lib/firebase.

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  type CollectionReference,
  type DocumentReference,
  type QueryConstraint,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Throws if Firestore is not configured (e.g. missing .env.local). */
export function getDb(): Firestore {
  if (!db) {
    throw new Error(
      "Firestore is not configured. Add your Firebase config to .env.local (see .env.local.example)."
    );
  }
  return db;
}

/** Get a Firestore collection reference. */
export function getCollection<T = Record<string, unknown>>(
  path: string,
  ...pathSegments: string[]
): CollectionReference<T> {
  return collection(getDb(), path, ...pathSegments) as CollectionReference<T>;
}

/** Get a Firestore document reference. */
export function getDocRef(path: string, ...pathSegments: string[]): DocumentReference {
  return doc(getDb(), path, ...pathSegments);
}

/** Fetch all documents in a collection, optionally ordered and filtered. */
export async function fetchCollection<T extends { id: string }>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
) {
  const col = getCollection(collectionPath);
  const q = constraints.length ? query(col, ...constraints) : col;
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

/** Fetch a single document by id. */
export async function fetchDoc<T>(collectionPath: string, docId: string): Promise<T | null> {
  const ref = getDocRef(collectionPath, docId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T;
}

/** Create a document with server timestamp. */
export async function createDoc<T extends Record<string, unknown>>(
  collectionPath: string,
  data: Omit<T, "id" | "createdAt" | "updatedAt"> & {
    createdAt?: unknown;
    updatedAt?: unknown;
  }
) {
  const ref = await addDoc(getCollection(collectionPath), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update a document with server timestamp. */
export async function updateDocTimestamp(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>
) {
  const ref = getDocRef(collectionPath, docId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/** Delete a document. */
export async function removeDoc(collectionPath: string, docId: string) {
  await deleteDoc(getDocRef(collectionPath, docId));
}

// Re-export common Firestore utilities for convenience
export {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
};
