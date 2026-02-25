"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { SEED_COST_CODES, type CostCode } from "@/types/costCodes";

export default function SettingsPage() {
  const [codes, setCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Inline editing state: { id -> { code, label } }
  const [editing, setEditing] = useState<Record<string, { code: string; label: string }>>({});

  // Track newly added code ID so we can auto-enter edit mode for it
  const pendingEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "costCodes"), orderBy("sortOrder", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const loaded: CostCode[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CostCode, "id">),
      }));

      // Auto-seed if collection is empty
      if (loaded.length === 0 && !seeding) {
        setSeeding(true);
        try {
          await Promise.all(
            SEED_COST_CODES.map((c) => addDoc(collection(db, "costCodes"), c))
          );
        } catch (err) {
          console.error("Failed to seed cost codes:", err);
        }
        setSeeding(false);
        return;
      }

      setCodes(loaded);
      setLoading(false);

      // Auto-start editing for the newly added row
      if (pendingEditIdRef.current) {
        const newCode = loaded.find((c) => c.id === pendingEditIdRef.current);
        if (newCode) {
          setEditing((prev) => ({
            ...prev,
            [newCode.id]: { code: newCode.code, label: newCode.label },
          }));
          pendingEditIdRef.current = null;
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(code: CostCode) {
    setEditing((prev) => ({
      ...prev,
      [code.id]: { code: code.code, label: code.label },
    }));
  }

  function exitEdit(id: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Save a single field to Firestore — does NOT exit edit mode (row blur handles that)
  async function saveField(id: string, field: "code" | "label", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const finalValue = field === "code" ? trimmed.toUpperCase() : trimmed;

    // Update local editing state with normalized value
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: finalValue },
    }));

    const current = codes.find((c) => c.id === id);
    if (!current || current[field] === finalValue) return; // no change

    try {
      await updateDoc(doc(db, "costCodes", id), { [field]: finalValue });
    } catch (err) {
      console.error("Failed to update cost code:", err);
    }
  }

  async function handleAddCode() {
    const maxOrder = codes.length > 0 ? Math.max(...codes.map((c) => c.sortOrder)) : 0;
    try {
      const ref = await addDoc(collection(db, "costCodes"), {
        code: "NEW",
        label: "New Code",
        sortOrder: maxOrder + 1,
      });
      pendingEditIdRef.current = ref.id;
    } catch (err) {
      console.error("Failed to add cost code:", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(db, "costCodes", id));
    } catch (err) {
      console.error("Failed to delete cost code:", err);
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= codes.length) return;

    const a = codes[index];
    const b = codes[swapIndex];

    try {
      await Promise.all([
        updateDoc(doc(db, "costCodes", a.id), { sortOrder: b.sortOrder }),
        updateDoc(doc(db, "costCodes", b.id), { sortOrder: a.sortOrder }),
      ]);
    } catch (err) {
      console.error("Failed to reorder cost codes:", err);
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage cost codes used across estimates and budget imports.</p>
        </div>

        {/* Cost Codes Section */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Cost Codes</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Click a code or label to edit inline. Order determines sort priority in tables.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCode}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add Code
            </button>
          </div>

          {loading || seeding ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              {seeding ? "Seeding default cost codes…" : "Loading…"}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-8">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Label</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Order</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {codes.map((c, i) => {
                  const ed = editing[c.id];
                  return (
                    <tr
                      key={c.id}
                      className="group hover:bg-gray-50"
                      onBlur={(e) => {
                        // Exit edit mode when focus leaves the entire row
                        if (ed && !e.currentTarget.contains(e.relatedTarget as Node)) {
                          saveField(c.id, "code", ed.code);
                          saveField(c.id, "label", ed.label);
                          exitEdit(c.id);
                        }
                      }}
                    >
                      {/* Row index */}
                      <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>

                      {/* Code field */}
                      <td className="px-4 py-2.5">
                        {ed ? (
                          <input
                            autoFocus
                            className="w-24 rounded border border-blue-400 px-1.5 py-0.5 text-xs font-mono font-semibold uppercase text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={ed.code}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], code: e.target.value.toUpperCase() },
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                // Move focus to label field
                                const row = e.currentTarget.closest("tr");
                                const labelInput = row?.querySelectorAll("input")[1] as HTMLInputElement | null;
                                labelInput?.focus();
                              }
                              if (e.key === "Escape") exitEdit(c.id);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="font-mono font-semibold text-gray-800 hover:text-blue-600 hover:underline"
                          >
                            {c.code}
                          </button>
                        )}
                      </td>

                      {/* Label field */}
                      <td className="px-4 py-2.5">
                        {ed ? (
                          <input
                            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={ed.label}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], label: e.target.value },
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") exitEdit(c.id);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="text-gray-700 hover:text-blue-600 hover:underline text-left"
                          >
                            {c.label}
                          </button>
                        )}
                      </td>

                      {/* Sort order number */}
                      <td className="px-4 py-2.5 text-right text-xs text-gray-400 tabular-nums">
                        {c.sortOrder}
                      </td>

                      {/* Actions: up/down/delete */}
                      <td className="px-3 py-2.5">
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
                            disabled={i === codes.length - 1}
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
                            onClick={() => handleDelete(c.id)}
                            className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && codes.length === 0 && !seeding && (
            <div className="py-10 text-center text-sm text-gray-400">
              No cost codes yet. Click &ldquo;Add Code&rdquo; to get started.
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Deleting a code only removes it from this list. Existing phases and estimates that used
          the code will continue to show the raw code string as a fallback.
        </p>

        {/* Exclusion Library */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Exclusion Library</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Manage standard exclusions used in estimates and proposals.
              </p>
            </div>
            <Link
              href="/settings/exclusions"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Manage →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
