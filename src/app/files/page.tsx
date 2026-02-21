"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import AppShell from "@/components/AppShell";
import { FileThumbnail } from "@/components/FileThumbnail";
import FileUpload from "@/components/FileUpload";
import { db, storage } from "@/lib/firebase";
import { formatBytes, type AppFile, type FileEntity } from "@/types/files";

const ENTITY_TABS: { label: string; value: FileEntity | "" }[] = [
  { label: "All", value: "" },
  { label: "Jobs", value: "job" },
  { label: "Employees", value: "employee" },
  { label: "Other", value: "other" },
];

function entityHref(file: AppFile): string {
  if (file.entityType === "job") return `/jobs/${file.entityId}`;
  if (file.entityType === "employee") return `/employees/${file.entityId}`;
  return "#";
}

function formatDate(ts: AppFile["uploadedAt"]): string {
  if (!ts) return "";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FilesPage() {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<FileEntity | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "files"), orderBy("uploadedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setFiles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppFile, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("files onSnapshot:", err);
        setLoading(false);
      }
    );
  }, []);

  const filtered = useMemo(() => {
    let list = files;
    if (entityFilter) list = list.filter((f) => f.entityType === entityFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          (f.entityName ?? "").toLowerCase().includes(term) ||
          (f.category ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [files, entityFilter, search]);

  async function handleDelete(file: AppFile) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      await deleteObject(ref(storage, file.storagePath));
    } catch (err) {
      console.warn("Storage delete failed:", err);
    }
    await deleteDoc(doc(db, "files", file.id));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Files</h1>
            <p className="mt-1 text-sm text-gray-600">{files.length} total</p>
          </div>
          <FileUpload entityType="other" entityId="general" entityName="General" label="Upload File" />
        </div>

        {/* Entity filter tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {ENTITY_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setEntityFilter(tab.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                entityFilter === tab.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by filename, entity, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              {files.length === 0 ? "No files uploaded yet." : "No results."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 w-14">Preview</th>
                    {["File", "Entity", "Category", "Size", "Uploaded", ""].map((h) => (
                      <th
                        key={h}
                        className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/50 group">
                      <td className="px-4 py-3">
                        <FileThumbnail file={f} className="w-10 h-10 shrink-0 rounded border border-gray-200 bg-gray-50 overflow-hidden" />
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <a
                          href={f.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline block truncate"
                        >
                          {f.name}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {f.entityName && f.entityType !== "other" ? (
                          <Link
                            href={entityHref(f)}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {f.entityName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">General</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {f.category ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {f.category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {formatBytes(f.size)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {formatDate(f.uploadedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(f)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Delete ${f.name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
