"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<ProjectPhase | "">("");
  const [search, setSearch] = useState("");

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
            if (count === 0 && phaseFilter !== phase) return null;
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
                  {["Job Name", "Phase", "GC", "Location", "Contract Value", ""].map(
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
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(job.currentContractValue ?? job.originalContractValue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/jobs/${job.id}/edit`}
                        className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                      >
                        Edit
                      </Link>
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
