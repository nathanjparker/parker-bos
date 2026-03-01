"use client";

import { useEffect, useMemo, useState } from "react";
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

interface ChangeOrder {
  id: string;
  coNumber: string;
  subject: string;
  jobId: string;
  jobName: string;
  jobNumber?: string;
  status: string;
  createdAt?: { toDate?: () => Date } | null;
}

function fmtDate(d?: { toDate?: () => Date } | null): string {
  if (!d?.toDate) return "";
  return d.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_ORDER: Record<string, number> = {
  "Under Review": 0,
  Submitted: 1,
  Draft: 2,
  Approved: 3,
  Rejected: 4,
};

export default function FieldDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCOs, setLoadingCOs] = useState(true);

  // Fetch active/awarded jobs
  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "in", ["Awarded", "Active", "Install"])
    );
    return onSnapshot(q, (snap) => {
      setJobs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
      );
      setLoadingJobs(false);
    });
  }, []);

  // Fetch all COs — filter client-side by visible jobs (Option B from spec)
  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCos(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChangeOrder, "id">),
        }))
      );
      setLoadingCOs(false);
    });
  }, []);

  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);

  const visibleCOs = useMemo(() => {
    return cos
      .filter((co) => jobIds.has(co.jobId))
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      );
  }, [cos, jobIds]);

  const loading = loadingJobs || loadingCOs;

  // Summary counts
  const pending = visibleCOs.filter(
    (co) => co.status === "Draft" || co.status === "Submitted" || co.status === "Under Review"
  );
  const approved = visibleCOs.filter((co) => co.status === "Approved");

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#F1F3F7]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#8B90A0]">Change orders across all jobs</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
        </div>
      ) : (
        <>
          {/* Summary chips */}
          <div className="mb-5 flex gap-3">
            <div className="flex-1 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-3">
              <div className="text-2xl font-bold text-[#EAB308]">
                {pending.length}
              </div>
              <div className="text-xs text-[#8B90A0] mt-0.5">Pending</div>
            </div>
            <div className="flex-1 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-3">
              <div className="text-2xl font-bold text-[#22C55E]">
                {approved.length}
              </div>
              <div className="text-xs text-[#8B90A0] mt-0.5">Approved</div>
            </div>
            <div className="flex-1 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-3">
              <div className="text-2xl font-bold text-[#F1F3F7]">
                {visibleCOs.length}
              </div>
              <div className="text-xs text-[#8B90A0] mt-0.5">Total</div>
            </div>
          </div>

          {/* CO list */}
          {visibleCOs.length === 0 ? (
            <div className="rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-10 text-center">
              <p className="text-[#585D6E]">No change orders yet.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] overflow-hidden">
              {visibleCOs.map((co, i) => (
                <Link
                  key={co.id}
                  href={`/field/jobs/${co.jobId}`}
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[#222633] ${
                    i < visibleCOs.length - 1 ? "border-b border-[#2A2E3B]" : ""
                  }`}
                >
                  {/* CO number */}
                  <span className="mt-0.5 font-mono text-xs font-bold text-[#3B82F6] whitespace-nowrap">
                    {co.coNumber}
                  </span>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#8B90A0] mb-0.5 truncate">
                      {co.jobNumber ? `${co.jobNumber} · ` : ""}
                      {co.jobName}
                    </div>
                    <div className="text-sm font-medium text-[#F1F3F7] truncate">
                      {co.subject}
                    </div>
                    {co.createdAt && (
                      <div className="text-xs text-[#585D6E] mt-0.5">
                        {fmtDate(co.createdAt)}
                      </div>
                    )}
                  </div>

                  <StatusBadge status={co.status} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
