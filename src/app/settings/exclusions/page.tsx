"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { SEED_EXCLUSIONS, type Exclusion } from "@/types/exclusions";

export default function ExclusionsSettingsPage() {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Inline editing state: id -> text being edited
  const [editing, setEditing] = useState<Record<string, string>>({});

  // New exclusion input
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  // Per-row delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Track newly added id for auto-focus
  const pendingEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "exclusionLibrary"), orderBy("sortOrder", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const loaded: Exclusion[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Exclusion, "id">),
      }));

      // Auto-seed if collection is empty
      if (loaded.length === 0 && !seeding) {
        setSeeding(true);
        try {
          await Promise.all(
            SEED_EXCLUSIONS.map((e) =>
              addDoc(collection(db, "exclusionLibrary"), {
                ...e,
                createdAt: serverTimestamp(),
              })
            )
          );
        } catch (err) {
          console.error("Failed to seed exclusions:", err);
        }
        setSeeding(false);
        return;
      }

      setExclusions(loaded);
      setLoading(false);

      // Auto-start editing for the newly added row
      if (pendingEditIdRef.current) {
        const added = loaded.find((e) => e.id === pendingEditIdRef.current);
        if (added) {
          setEditing((prev) => ({ ...prev, [added.id]: added.text }));
          pendingEditIdRef.current = null;
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(ex: Exclusion) {
    setEditing((prev) => ({ ...prev, [ex.id]: ex.text }));
  }

  function exitEdit(id: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveText(id: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = exclusions.find((e) => e.id === id);
    if (!current || current.text === trimmed) return;
    try {
      await updateDoc(doc(db, "exclusionLibrary", id), { text: trimmed });
    } catch (err) {
      console.error("Failed to update exclusion:", err);
    }
  }

  async function handleAdd() {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setAdding(true);
    const maxOrder =
      exclusions.length > 0 ? Math.max(...exclusions.map((e) => e.sortOrder)) : 0;
    try {
      const ref = await addDoc(collection(db, "exclusionLibrary"), {
        text: trimmed,
        sortOrder: maxOrder + 1,
        active: true,
        createdAt: serverTimestamp(),
      });
      setNewText("");
      pendingEditIdRef.current = ref.id;
    } catch (err) {
      console.error("Failed to add exclusion:", err);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(db, "exclusionLibrary", id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete exclusion:", err);
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= exclusions.length) return;
    const a = exclusions[index];
    const b = exclusions[swapIndex];
    try {
      await Promise.all([
        updateDoc(doc(db, "exclusionLibrary", a.id), { sortOrder: b.sortOrder }),
        updateDoc(doc(db, "exclusionLibrary", b.id), { sortOrder: a.sortOrder }),
      ]);
    } catch (err) {
      console.error("Failed to reorder exclusions:", err);
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/settings" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
            ← Settings
          </Link>
          <h1 className="mt-2 text-xl font-bold text-gray-900">Exclusion Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Standard exclusions used in estimates and proposals. Click any item to edit inline.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Header with add form */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Exclusions</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Click an item to edit inline. Order controls display sequence.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="New exclusion…"
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !newText.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add
              </button>
            </div>
          </div>

          {loading || seeding ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              {seeding ? "Seeding default exclusions…" : "Loading…"}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-8">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Exclusion</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {exclusions.map((ex, i) => {
                  const editText = editing[ex.id];
                  const isEditing = editText !== undefined;
                  const isConfirmDelete = confirmDeleteId === ex.id;
                  return (
                    <tr
                      key={ex.id}
                      className="group hover:bg-gray-50"
                      onBlur={(e) => {
                        if (isEditing && !e.currentTarget.contains(e.relatedTarget as Node)) {
                          saveText(ex.id, editText);
                          exitEdit(ex.id);
                        }
                      }}
                    >
                      {/* Row index */}
                      <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>

                      {/* Text field */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editText}
                            onChange={(e) =>
                              setEditing((prev) => ({ ...prev, [ex.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") exitEdit(ex.id);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(ex)}
                            className="text-gray-700 hover:text-blue-600 hover:underline text-left w-full"
                          >
                            {ex.text}
                          </button>
                        )}
                      </td>

                      {/* Actions: confirm-delete inline, or up/down/delete icons */}
                      <td className="px-3 py-2.5">
                        {isConfirmDelete ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleDelete(ex.id)}
                              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-1.5 py-0.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => handleMove(i, "up")}
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                              title="Move up"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              disabled={i === exclusions.length - 1}
                              onClick={() => handleMove(i, "down")}
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                              title="Move down"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ex.id)}
                              className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && exclusions.length === 0 && !seeding && (
            <div className="py-10 text-center text-sm text-gray-400">
              No exclusions yet. Add one above.
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Deleting an exclusion only removes it from this library. Existing estimates that already
          included it will not be affected.
        </p>
      </div>
    </AppShell>
  );
}
