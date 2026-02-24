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
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  PROJECT_PHASES,
  PHASE_BADGE_CLASS,
  type Job,
  type ProjectPhase,
} from "@/types/jobs";

function formatCurrency(n: number | undefined): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatBidDueDate(job: Job): string {
  const bd = job.bidDueDate;
  if (bd == null || typeof (bd as { toDate?: () => Date }).toDate !== "function")
    return "—";
  return (bd as { toDate: () => Date }).toDate().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<ProjectPhase | "">("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(job: Job) {
    if (
      !window.confirm(
        `Delete job "${job.jobName}"? This cannot be undone.`
      )
    )
      return;
    setDeletingId(job.id);
    try {
      await deleteDoc(doc(db, "Jobs", job.id));
    } catch (err) {
      console.error("Delete job error:", err);
      alert("Failed to delete job. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    const q = query(collection(db, "Jobs"), orderBy("jobName", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Job[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Job, "id">),
        }));
        setJobs(list);
        setLoading(false);
      },
      (err) => {
        console.error("Jobs onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const phaseCounts = useMemo(() => {
    const counts: Partial<Record<ProjectPhase, number>> = {};
    for (const j of jobs) {
      counts[j.projectPhase] = (counts[j.projectPhase] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (phaseFilter) list = list.filter((j) => j.projectPhase === phaseFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.jobName.toLowerCase().includes(term) ||
          (j.gcName ?? "").toLowerCase().includes(term) ||
          (j.siteCity ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [jobs, phaseFilter, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="mt-1 text-sm text-gray-600">
              {jobs.length} total &middot;{" "}
              {jobs.filter((j) => j.projectPhase === "Active").length} active
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + New Job
          </Link>
        </div>

        {/* Phase filter tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhaseFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              phaseFilter === ""
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({jobs.length})
          </button>
          {PROJECT_PHASES.map((phase) => {
            const count = phaseCounts[phase] ?? 0;
            if (count === 0 && phaseFilter !== phase && phase !== "Install") return null;
            return (
              <button
                key={phase}
                type="button"
                onClick={() =>
                  setPhaseFilter(phaseFilter === phase ? "" : phase)
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  phaseFilter === phase
                    ? "bg-gray-900 text-white"
                    : `${PHASE_BADGE_CLASS[phase]} hover:opacity-80`
                }`}
              >
                {phase} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by name, GC, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {jobs.length === 0
                  ? "No jobs yet."
                  : "No jobs match the current filters."}
              </p>
              {jobs.length === 0 && (
                <Link
                  href="/jobs/new"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + New Job
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {["Job Name", "Phase", "GC", "Location", "Bid Due", "Contract Value", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {job.jobName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          PHASE_BADGE_CLASS[job.projectPhase]
                        }`}
                      >
                        {job.projectPhase}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {job.gcName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {[job.siteCity, job.siteState].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatBidDueDate(job)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(job.currentContractValue ?? job.originalContractValue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        <Link
                          href={`/jobs/${job.id}/edit`}
                          className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(job)}
                          disabled={deletingId === job.id}
                          title="Delete job"
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
