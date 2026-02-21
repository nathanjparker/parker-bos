"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { formatBytes, type AppFile, type FileEntity } from "@/types/files";
import { FileThumbnail } from "@/components/FileThumbnail";
import FileUpload from "@/components/FileUpload";

interface Props {
  entityType: FileEntity;
  entityId: string;
  entityName?: string;
  /** Filter to a single category (client-side) */
  category?: string;
  /** If true, render one section per category with an upload button per section */
  groupByCategory?: boolean;
  categories?: string[];
}

function formatDate(ts: AppFile["uploadedAt"]): string {
  if (!ts) return "";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function FileRow({
  file,
  onDelete,
}: {
  file: AppFile;
  onDelete: (file: AppFile) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-1 group">
      <FileThumbnail file={file} />
      <div className="flex-1 min-w-0">
        <a
          href={file.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 hover:underline truncate block"
        >
          {file.name}
        </a>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {formatBytes(file.size)} · {formatDate(file.uploadedAt)}
          {file.uploadedBy && ` · ${file.uploadedBy}`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(file)}
        className="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Delete ${file.name}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export default function FileList({
  entityType,
  entityId,
  entityName,
  category,
  groupByCategory = false,
  categories = [],
}: Props) {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "files"),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId),
      orderBy("uploadedAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setFiles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppFile, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("FileList onSnapshot:", err);
        setLoading(false);
      }
    );
  }, [entityType, entityId]);

  async function handleDelete(file: AppFile) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      await deleteObject(ref(storage, file.storagePath));
    } catch (err) {
      console.warn("Storage delete failed (file may already be gone):", err);
    }
    await deleteDoc(doc(db, "files", file.id));
  }

  const visibleFiles = category ? files.filter((f) => f.category === category) : files;

  if (loading) {
    return <p className="text-sm text-gray-400 py-2">Loading files…</p>;
  }

  if (groupByCategory && categories.length > 0) {
    return (
      <div className="space-y-4">
        {categories.map((cat) => {
          const catFiles = files.filter((f) => f.category === cat);
          return (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{cat}</span>
                <FileUpload
                  entityType={entityType}
                  entityId={entityId}
                  entityName={entityName}
                  category={cat}
                  label={`Upload ${cat}`}
                />
              </div>
              {catFiles.length === 0 ? (
                <p className="text-[11px] text-gray-400 pl-1">No {cat.toLowerCase()} files yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {catFiles.map((f) => (
                    <FileRow key={f.id} file={f} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (visibleFiles.length === 0) {
    return <p className="text-sm text-gray-400 py-2">No files yet.</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {visibleFiles.map((f) => (
        <FileRow key={f.id} file={f} onDelete={handleDelete} />
      ))}
    </div>
  );
}
