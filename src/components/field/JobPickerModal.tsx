"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import StatusBadge from "@/components/field/StatusBadge";
import type { Job } from "@/types/jobs";

interface Props {
  onSelect: (job: Job) => void;
  onClose: () => void;
}

export default function JobPickerModal({ onSelect, onClose }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "in", ["Awarded", "Active", "Install"]),
      orderBy("jobName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setJobs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
      );
    });
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    const jn = (j as unknown as Record<string, string>).jobNumber ?? "";
    return (
      j.jobName.toLowerCase().includes(q) ||
      jn.toLowerCase().includes(q) ||
      (j.gcName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-[#0F1117] flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex flex-col items-center px-4 pt-3 pb-4">
          <div className="h-1 w-10 rounded-full bg-[#2A2E3B] mb-4" />
          <div className="flex w-full items-center justify-between">
            <h2 className="text-lg font-bold text-[#F1F3F7]">Select Job</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#222633] text-[#8B90A0] hover:text-[#F1F3F7] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#585D6E]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs…"
              autoFocus
              className="w-full rounded-xl border border-[#2A2E3B] bg-[#1A1D27] py-2.5 pl-9 pr-3 text-sm text-[#F1F3F7] placeholder-[#585D6E] outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#585D6E]">No jobs found.</p>
          )}
          {filtered.map((job) => {
            const jobNumber = (job as unknown as Record<string, string>).jobNumber ?? "";
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelect(job)}
                className="w-full text-left rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-3 transition-colors hover:bg-[#222633]"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {jobNumber && (
                    <span className="font-mono text-xs font-bold text-[#3B82F6]">
                      {jobNumber}
                    </span>
                  )}
                  <StatusBadge status={job.projectPhase} size="sm" />
                </div>
                <div className="text-sm font-semibold text-[#F1F3F7]">
                  {job.jobName}
                </div>
                {job.gcName && (
                  <div className="text-xs text-[#8B90A0]">{job.gcName}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
