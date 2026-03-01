"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function FieldJobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    });
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    const jobNumber = (j as unknown as Record<string, string>).jobNumber ?? "";
    return (
      j.jobName.toLowerCase().includes(q) ||
      jobNumber.toLowerCase().includes(q) ||
      (j.gcName ?? "").toLowerCase().includes(q) ||
      (j.siteAddress ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#F1F3F7]">My Jobs</h1>
        <p className="mt-0.5 text-sm text-[#8B90A0]">Active and awarded projects</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#585D6E]"
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
          className="w-full rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] py-3 pl-10 pr-4 text-sm text-[#F1F3F7] placeholder-[#585D6E] outline-none focus:border-[#3B82F6] transition-colors"
        />
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[#585D6E]">
            {search ? "No jobs match your search." : "No active jobs."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const jobNumber = (job as unknown as Record<string, string>).jobNumber ?? "";
            const address = [job.siteAddress, job.siteCity]
              .filter(Boolean)
              .join(", ");
            return (
              <Link
                key={job.id}
                href={`/field/jobs/${job.id}`}
                className="block rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-4 transition-colors hover:bg-[#222633] active:bg-[#222633]"
              >
                {/* Top row: job number + status */}
                <div className="flex items-center gap-2 mb-1">
                  {jobNumber && (
                    <span className="font-mono text-xs font-bold text-[#3B82F6]">
                      {jobNumber}
                    </span>
                  )}
                  <StatusBadge status={job.projectPhase} size="sm" />
                </div>

                {/* Job name */}
                <div className="text-base font-semibold text-[#F1F3F7]">
                  {job.jobName}
                </div>

                {/* GC and address */}
                <div className="mt-0.5 space-y-0.5">
                  {job.gcName && (
                    <div className="text-sm text-[#8B90A0]">{job.gcName}</div>
                  )}
                  {address && (
                    <div className="text-xs text-[#585D6E]">{address}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
