"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SpecEntry {
  id: string;
  manufacturer: string;
  model: string;
  url: string;
  uploadedAt: Timestamp | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SpecSheetLibraryModal({ open, onClose }: Props) {
  const [entries, setEntries] = useState<SpecEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "specSheetLibrary"), (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SpecEntry, "id">) }))
        .sort((a, b) =>
          a.manufacturer.localeCompare(b.manufacturer) ||
          a.model.localeCompare(b.model)
        );
      setEntries(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [open]);

  if (!open) return null;

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
          e.model.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  async function handleDelete(entry: SpecEntry) {
    if (!window.confirm(`Remove spec sheet for ${entry.manufacturer} ${entry.model} from the library?`)) return;
    setDeleting(entry.id);
    try {
      await deleteDoc(doc(db, "specSheetLibrary", entry.id));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Spec Sheet Library</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {entries.length} spec sheet{entries.length !== 1 ? "s" : ""} saved globally
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-gray-100">
            <input
              type="search"
              placeholder="Search manufacturer or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {entries.length === 0
                  ? "No spec sheets uploaded yet. Upload spec sheets from the fixture detail drawer."
                  : "No results match your search."}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Manufacturer</th>
                    <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Model</th>
                    <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Spec Sheet</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="px-6 py-3 font-medium text-gray-800">{e.manufacturer}</td>
                      <td className="px-6 py-3 text-gray-600">{e.model}</td>
                      <td className="px-6 py-3">
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View PDF
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(e)}
                          disabled={deleting === e.id}
                          className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Remove from library"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
