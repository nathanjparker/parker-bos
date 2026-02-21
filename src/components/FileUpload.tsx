"use client";

import { useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage, getFirebaseAuth } from "@/lib/firebase";
import type { FileEntity } from "@/types/files";

interface UploadingFile {
  id: string;
  name: string;
  progress: number; // 0–100
  error?: string;
}

interface Props {
  entityType: FileEntity;
  entityId: string;
  entityName?: string;
  category?: string;
  label?: string; // button label override
}

export default function FileUpload({
  entityType,
  entityId,
  entityName,
  category,
  label = "Upload File",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  function setProgress(id: string, progress: number, error?: string) {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, progress, error } : u))
    );
  }

  async function handleFiles(files: FileList) {
    const auth = (() => {
      try { return getFirebaseAuth(); } catch { return null; }
    })();
    const userEmail = auth?.currentUser?.email ?? "unknown";

    const fileList = Array.from(files);
    const newUploads: UploadingFile[] = fileList.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: f.name,
      progress: 0,
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const uploadId = newUploads[i].id;
      const folder =
        entityType === "job"
          ? `files/jobs/${entityId}/${category ?? "Other"}`
          : entityType === "employee"
          ? `files/employees/${entityId}`
          : "files/other";
      const storagePath = `${folder}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setProgress(uploadId, pct);
            },
            (err) => {
              setProgress(uploadId, 0, err.message);
              reject(err);
            },
            async () => {
              const downloadUrl = await getDownloadURL(task.snapshot.ref);
              const payload: Record<string, unknown> = {
                name: file.name,
                storagePath,
                downloadUrl,
                size: file.size,
                contentType: file.type || "application/octet-stream",
                entityType,
                entityId,
                uploadedBy: userEmail,
                uploadedAt: serverTimestamp(),
              };
              if (entityName) payload.entityName = entityName;
              if (category) payload.category = category;
              await addDoc(collection(db, "files"), payload);
              resolve();
            }
          );
        });
        // Remove from in-progress list after success
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      } catch {
        // error already set via setProgress
      }
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + {label}
      </button>

      {uploads.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {uploads.map((u) => (
            <div key={u.id}>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
                <span className="truncate max-w-[200px]">{u.name}</span>
                {u.error ? (
                  <span className="text-red-500 text-[11px]">Failed</span>
                ) : (
                  <span>{u.progress}%</span>
                )}
              </div>
              <div className="h-1 w-full rounded-full bg-gray-100">
                <div
                  className={`h-1 rounded-full transition-all ${
                    u.error ? "bg-red-400" : "bg-blue-500"
                  }`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              {u.error && (
                <p className="text-[11px] text-red-500 mt-0.5">{u.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
