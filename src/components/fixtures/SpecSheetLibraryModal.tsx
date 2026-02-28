"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { Timestamp as FbTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import type { SpecSheetLibraryEntry } from "@/types/fixtures";

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  linkMode?: { fixtureId: string; jobId: string };
  onLink?: (entry: SpecSheetLibraryEntry) => void;
}

type Tab = "browse" | "upload";

// ── Helpers ──────────────────────────────────────────────────────────────────

function docToEntry(d: { id: string; data: () => Record<string, unknown> }): SpecSheetLibraryEntry {
  const raw = d.data() as Omit<SpecSheetLibraryEntry, "id">;
  return {
    id: d.id,
    manufacturer: raw.manufacturer ?? "",
    model: raw.model ?? "",
    description: raw.description ?? "",
    pdfUrl: raw.pdfUrl ?? (raw as Record<string, unknown>).url as string ?? "",
    storagePath: raw.storagePath ?? "",
    version: raw.version ?? 1,
    versionHistory: Array.isArray(raw.versionHistory) ? raw.versionHistory : [],
    uploadedAt: raw.uploadedAt as Timestamp,
    updatedAt: raw.updatedAt as Timestamp,
    usageCount: raw.usageCount ?? 0,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SpecSheetLibraryModal({ open, onClose, linkMode, onLink }: Props) {
  const [tab, setTab] = useState<Tab>("browse");
  const [entries, setEntries] = useState<SpecSheetLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Upload tab state
  const [upManufacturer, setUpManufacturer] = useState("");
  const [upModel, setUpModel] = useState("");
  const [upDescription, setUpDescription] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // Update PDF state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);

  // Load entries
  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "specSheetLibrary"), (snap) => {
      const docs = snap.docs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d) => docToEntry(d as any))
        .sort((a, b) =>
          a.manufacturer.localeCompare(b.manufacturer) ||
          a.model.localeCompare(b.model)
        );
      setEntries(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTab("browse");
      setSearch("");
      resetUploadForm();
    }
  }, [open]);

  if (!open) return null;

  function resetUploadForm() {
    setUpManufacturer("");
    setUpModel("");
    setUpDescription("");
    setUpFile(null);
    setUploading(false);
    setUploadProgress(null);
    setUploadError("");
    setUploadSuccess("");
    if (uploadFileRef.current) uploadFileRef.current.value = "";
  }

  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.manufacturer.toLowerCase().includes(q) ||
          e.model.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
        );
      })
    : entries;

  // ── Upload new spec sheet ────────────────────────────────────────────────

  async function handleUpload() {
    if (!upManufacturer.trim() || !upModel.trim() || !upDescription.trim() || !upFile) return;
    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    // Check for duplicate
    const dupeSnap = await getDocs(
      query(
        collection(db, "specSheetLibrary"),
        where("manufacturerKey", "==", upManufacturer.trim().toLowerCase()),
        where("modelKey", "==", upModel.trim().toLowerCase())
      )
    );

    if (!dupeSnap.empty) {
      const existing = dupeSnap.docs[0];
      const ok = window.confirm(
        `A spec sheet for ${upManufacturer.trim()} / ${upModel.trim()} already exists (v${existing.data().version ?? 1}). Update it with the new PDF?`
      );
      if (ok) {
        await handleUpdatePdf(existing.id, upFile);
        resetUploadForm();
        setTab("browse");
      }
      setUploading(false);
      return;
    }

    // Create new entry
    try {
      const docRef = await addDoc(collection(db, "specSheetLibrary"), {
        manufacturer: upManufacturer.trim(),
        model: upModel.trim(),
        description: upDescription.trim(),
        manufacturerKey: upManufacturer.trim().toLowerCase(),
        modelKey: upModel.trim().toLowerCase(),
        pdfUrl: "",
        storagePath: "",
        version: 1,
        versionHistory: [],
        uploadedAt: FbTimestamp.now(),
        updatedAt: FbTimestamp.now(),
        usageCount: 0,
      });

      const storagePath = `specSheets/library/${docRef.id}/v1.pdf`;
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, upFile);

      setUploadProgress(0);
      task.on(
        "state_changed",
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        () => {
          setUploadError("Upload failed. Please try again.");
          setUploadProgress(null);
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await updateDoc(doc(db, "specSheetLibrary", docRef.id), {
            pdfUrl: url,
            storagePath,
          });
          setUploadProgress(null);
          setUploadSuccess(`Uploaded: ${upManufacturer.trim()} ${upModel.trim()}`);
          setUploading(false);
          resetUploadForm();
          setTab("browse");
        }
      );
    } catch {
      setUploadError("Failed to create entry. Please try again.");
      setUploading(false);
    }
  }

  // ── Update existing PDF ────────────────────────────────────────────────

  async function handleUpdatePdf(entryId: string, file: File) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    setUpdatingId(entryId);
    setUpdateProgress(0);

    const newVersion = entry.version + 1;
    const storagePath = `specSheets/library/${entryId}/v${newVersion}.pdf`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setUpdateProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => {
        setUpdatingId(null);
        setUpdateProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, "specSheetLibrary", entryId), {
          pdfUrl: url,
          storagePath,
          version: newVersion,
          updatedAt: FbTimestamp.now(),
          versionHistory: [
            ...entry.versionHistory,
            {
              version: entry.version,
              pdfUrl: entry.pdfUrl,
              replacedAt: FbTimestamp.now(),
            },
          ],
        });
        setUpdatingId(null);
        setUpdateProgress(null);
        if (updateFileRef.current) updateFileRef.current.value = "";
      }
    );
  }

  // ── Link to fixture ────────────────────────────────────────────────────

  function handleLink(entry: SpecSheetLibraryEntry) {
    onLink?.(entry);
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Spec Sheet Library</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {entries.length} spec sheet{entries.length !== 1 ? "s" : ""} saved globally
                {linkMode && " — select one to link"}
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

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6">
            {(["browse", "upload"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "browse" ? "Browse" : "Upload"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "browse" ? (
            <>
              {/* Search */}
              <div className="px-6 py-3 border-b border-gray-100">
                <input
                  type="search"
                  placeholder="Search manufacturer, model, or description..."
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
                      ? "No spec sheets uploaded yet. Use the Upload tab to add one."
                      : "No results match your search."}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Manufacturer</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Model</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Description</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 w-12">Ver</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((e) => (
                        <tr key={e.id} className="group">
                          <td className="px-6 py-3 font-medium text-gray-800">{e.manufacturer}</td>
                          <td className="px-6 py-3 text-gray-600">{e.model}</td>
                          <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{e.description}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-400">v{e.version}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {e.pdfUrl && (
                                <a
                                  href={e.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  View PDF
                                </a>
                              )}
                              <label className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                                {updatingId === e.id && updateProgress !== null ? (
                                  <span>{updateProgress}%</span>
                                ) : (
                                  "Update PDF"
                                )}
                                <input
                                  ref={updatingId === e.id ? updateFileRef : undefined}
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={(ev) => {
                                    const file = ev.target.files?.[0];
                                    if (file) handleUpdatePdf(e.id, file);
                                  }}
                                />
                              </label>
                              {linkMode && onLink && (
                                <button
                                  type="button"
                                  onClick={() => handleLink(e)}
                                  className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                >
                                  Link
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            /* Upload tab */
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    value={upManufacturer}
                    onChange={(e) => setUpManufacturer(e.target.value)}
                    placeholder="e.g. Kohler"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Model *</label>
                  <input
                    type="text"
                    value={upModel}
                    onChange={(e) => setUpModel(e.target.value)}
                    placeholder="e.g. K-3609"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <input
                  type="text"
                  value={upDescription}
                  onChange={(e) => setUpDescription(e.target.value)}
                  placeholder="e.g. Kohler Cimarron Elongated Toilet"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PDF File *</label>
                <input
                  ref={uploadFileRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUpFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {uploadProgress !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-32 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {uploadProgress}%
                </div>
              )}
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              {uploadSuccess && <p className="text-xs text-green-600">{uploadSuccess}</p>}
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !upManufacturer.trim() || !upModel.trim() || !upDescription.trim() || !upFile}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Spec Sheet"}
              </button>
            </div>
          )}

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
