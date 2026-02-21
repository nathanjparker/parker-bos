"use client";

import type { AppFile } from "@/types/files";

export function isImageFile(file: AppFile): boolean {
  const type = (file.contentType ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name);
}

const sizeClass = "w-12 h-12 shrink-0 rounded border border-gray-200 bg-gray-50 overflow-hidden";

export function FileThumbnail({
  file,
  className = sizeClass,
}: {
  file: AppFile;
  className?: string;
}) {
  const isImage = isImageFile(file);
  if (isImage) {
    return (
      <a
        href={file.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} block focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded`}
      >
        <img
          src={file.downloadUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={file.downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} flex items-center justify-center text-gray-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded`}
      aria-hidden
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </a>
  );
}
