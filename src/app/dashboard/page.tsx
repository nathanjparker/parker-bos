"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";

type Card = {
  title: string;
  description: string;
};

type TestNote = {
  id: string;
  text: string;
  createdAt: Date | null;
  createdBy: string | null;
};

const cards: Card[] = [
  { title: "Jobs", description: "Track jobs, contacts, and status at a glance." },
  { title: "Change Orders", description: "Draft, approve, and log change orders." },
  { title: "Purchase Orders", description: "Create POs and tie them back to jobs." },
  { title: "Files", description: "Upload job files to Firebase Storage." },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<TestNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [addingNote, setAddingNote] = useState(false);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      setConfigError("Firebase isn’t configured. Add your `.env.local` values and restart `npm run dev`.");
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setChecking(false);
    });

    return () => unsub();
  }, [auth, router]);

  // Subscribe to test_notes for the current user
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "test_notes"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextNotes: TestNote[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as {
            text?: string;
            createdAt?: Timestamp;
            createdBy?: string;
          };
          return {
            id: docSnap.id,
            text: data.text ?? "",
            createdAt: data.createdAt ? data.createdAt.toDate() : null,
            createdBy: data.createdBy ?? null,
          };
        });
        setNotes(nextNotes);
        setNotesLoading(false);
        setNotesError(null);
      },
      () => {
        setNotesError("Failed to load test notes from Firestore.");
        setNotesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  async function handleSignOut() {
    if (!auth) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleAddNote() {
    if (!user) return;
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setAddingNote(true);
    setNotesError(null);
    try {
      await addDoc(collection(db, "test_notes"), {
        text: trimmed,
        createdAt: serverTimestamp(),
        createdBy: user.email ?? null,
      });
      setNoteText("");
    } catch {
      setNotesError("Failed to add note. Check your Firestore rules and network connection.");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleDeleteNote(id: string) {
    setNotesError(null);
    try {
      await deleteDoc(doc(db, "test_notes", id));
    } catch {
      setNotesError("Failed to delete note. Check your Firestore rules and network connection.");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <main className="w-full max-w-md rounded-2xl bg-white shadow-lg px-8 py-10 border border-gray-100 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
            PB
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Parker BOS</h1>
          <p className="mt-2 text-sm text-gray-600">Loading your dashboard…</p>
          <div className="mt-6 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          </div>
        </main>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <main className="w-full max-w-md rounded-2xl bg-white shadow-lg px-8 py-10 border border-gray-100 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
            PB
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Parker BOS</h1>
          <p className="mt-3 text-sm text-red-700 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            {configError}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Go to login
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-blue-600 uppercase">
              Parker Services
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Signed in as{" "}
              <span className="font-semibold text-gray-900">
                {user?.displayName ?? "Unknown user"}
              </span>{" "}
              <span className="text-gray-500">({user?.email ?? "no email"})</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {c.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">{c.description}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  Coming soon
                </span>
              </div>
              <div className="mt-5 h-24 rounded-xl border border-dashed border-gray-200 bg-gray-50" />
            </div>
          ))}
        </section>

        <section className="mt-10 max-w-3xl">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Quick Test
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Create, read, and delete notes in the <span className="font-mono">test_notes</span> collection
                  to verify Firestore connectivity.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Type a quick test note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {addingNote ? "Adding…" : "Add note"}
              </button>
            </div>

            {notesError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {notesError}
              </p>
            ) : null}

            <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
              {notesLoading ? (
                <p className="text-xs text-gray-500">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-gray-500">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{note.text}</p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {note.createdAt
                            ? note.createdAt.toLocaleString()
                            : "Pending…"}
                          {note.createdBy
                            ? ` • ${note.createdBy}`
                            : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

