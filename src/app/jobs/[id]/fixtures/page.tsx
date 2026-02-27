"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import type { Job } from "@/types/jobs";
import {
  getFixtureCategory,
  isParkerItem,
  getPhaseLabel,
  PROCUREMENT_STATUSES,
  SUBMITTAL_STATUSES,
  PROCUREMENT_COLORS,
  SUBMITTAL_COLORS,
  PHASE_BADGE_COLORS,
  type JobFixture,
  type ProcurementStatus,
  type SubmittalStatus,
  type FixtureCategory,
} from "@/types/fixtures";
import FixtureDetailDrawer from "@/components/fixtures/FixtureDetailDrawer";
import SpecSheetLibraryModal from "@/components/fixtures/SpecSheetLibraryModal";

const CATEGORY_TABS: FixtureCategory[] = ["Parker Fixture", "Parker Equipment", "By Others"];

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function FixturesPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [fixtures, setFixtures] = useState<JobFixture[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer
  const [selectedFixture, setSelectedFixture] = useState<JobFixture | null>(null);
  // Spec library modal
  const [showSpecLibrary, setShowSpecLibrary] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [procurementFilter, setProcurementFilter] = useState<ProcurementStatus | "">("");
  const [submittalFilter, setSubmittalFilter] = useState<SubmittalStatus | "">("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [categoryTab, setCategoryTab] = useState<FixtureCategory | "All">("All");

  // Load job
  useEffect(() => {
    if (!jobId) return;
    const unsub = onSnapshot(doc(db, "Jobs", jobId), (snap) => {
      if (snap.exists()) setJob({ id: snap.id, ...(snap.data() as Omit<Job, "id">) });
    });
    return () => unsub();
  }, [jobId]);

  // Load fixtures
  useEffect(() => {
    if (!jobId) return;
    const q = query(
      collection(db, "jobFixtures"),
      where("jobId", "==", jobId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<JobFixture, "id">) }))
        .sort((a, b) => a.materialGroup.localeCompare(b.materialGroup) || a.sortOrder - b.sortOrder);
      setFixtures(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [jobId]);

  // Distinct phases for filter dropdown
  const distinctPhases = useMemo(
    () => Array.from(new Set(fixtures.map((f) => f.costCode))).sort(),
    [fixtures]
  );

  // Filtered + tab-narrowed fixtures
  const filtered = useMemo(() => {
    let list = fixtures;
    if (categoryTab !== "All") list = list.filter((f) => getFixtureCategory(f.materialGroup) === categoryTab);
    if (phaseFilter) list = list.filter((f) => f.costCode === phaseFilter);
    if (procurementFilter) list = list.filter((f) => f.procurementStatus === procurementFilter);
    if (submittalFilter) list = list.filter((f) => f.submittalStatus === submittalFilter);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.description.toLowerCase().includes(q) ||
          (f.manufacturer ?? "").toLowerCase().includes(q) ||
          (f.model ?? "").toLowerCase().includes(q) ||
          (f.vendor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [fixtures, categoryTab, phaseFilter, procurementFilter, submittalFilter, searchText]);

  // Summary counts
  const totalCount = fixtures.length;
  const parkerCount = fixtures.filter((f) => isParkerItem(f.materialGroup)).length;
  const byOthersCount = totalCount - parkerCount;

  async function handleStatusChange(fixture: JobFixture, field: "procurementStatus" | "submittalStatus", value: string) {
    // Optimistic update
    setFixtures((prev) =>
      prev.map((f) => (f.id === fixture.id ? { ...f, [field]: value } : f))
    );
    try {
      await updateDoc(doc(db, "jobFixtures", fixture.id), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Revert on error
      setFixtures((prev) =>
        prev.map((f) => (f.id === fixture.id ? { ...f, [field]: fixture[field] } : f))
      );
    }
  }

  // Keep drawer in sync with latest fixture data
  useEffect(() => {
    if (!selectedFixture) return;
    const updated = fixtures.find((f) => f.id === selectedFixture.id);
    if (updated) setSelectedFixture(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <a href="/jobs" className="hover:text-gray-600">Jobs</a>
              <span>/</span>
              <a href={`/jobs/${jobId}`} className="hover:text-gray-600">
                {job?.jobName ?? "…"}
              </a>
              <span>/</span>
              <span className="text-gray-700 font-medium">Fixtures & Equipment</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Fixtures &amp; Equipment
              {job?.jobName ? ` — ${job.jobName}` : ""}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {totalCount} items · {parkerCount} Parker · {byOthersCount} by others
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSpecLibrary(true)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Spec Library
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(["All", ...CATEGORY_TABS] as (FixtureCategory | "All")[]).map((tab) => {
            const count = tab === "All"
              ? fixtures.length
              : fixtures.filter((f) => getFixtureCategory(f.materialGroup) === tab).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  categoryTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
                <span className="ml-1.5 text-xs text-gray-400 font-normal">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search description, manufacturer, model…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-72"
          />
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All phases</option>
            {distinctPhases.map((code) => (
              <option key={code} value={code}>{getPhaseLabel(code)}</option>
            ))}
          </select>
          <select
            value={procurementFilter}
            onChange={(e) => setProcurementFilter(e.target.value as ProcurementStatus | "")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All procurement</option>
            {PROCUREMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={submittalFilter}
            onChange={(e) => setSubmittalFilter(e.target.value as SubmittalStatus | "")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All submittals</option>
            {SUBMITTAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(searchText || phaseFilter || procurementFilter || submittalFilter) && (
            <button
              type="button"
              onClick={() => { setSearchText(""); setPhaseFilter(""); setProcurementFilter(""); setSubmittalFilter(""); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              {fixtures.length === 0
                ? "No fixtures imported yet. Award an estimate with a fixture schedule to populate this list."
                : "No items match the current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Phase</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-12">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-16">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Manufacturer / Model</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Budget</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 w-12">Spec</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Procurement</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Submittal</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((f) => {
                    const byOthers = getFixtureCategory(f.materialGroup) === "By Others";
                    const phaseBadge = PHASE_BADGE_COLORS[f.costCode] ?? "bg-gray-100 text-gray-600";
                    return (
                      <tr
                        key={f.id}
                        className={`group ${byOthers ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${phaseBadge}`}>
                            {getPhaseLabel(f.costCode)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{f.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">{f.size ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-800 max-w-xs">
                          <div className="truncate" title={f.description}>{f.description}</div>
                          {byOthers && (
                            <span className="text-xs text-gray-400">By Others</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {f.manufacturer ? (
                            <>
                              <div className="font-medium text-gray-800">{f.manufacturer}</div>
                              {f.model && <div className="text-xs text-gray-500">{f.model}</div>}
                            </>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {fmt(f.budgetUnitPrice)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {f.specSheetUrl ? (
                            <a
                              href={f.specSheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="View spec sheet"
                              className="inline-flex text-green-600 hover:text-green-700"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-gray-300">
                              <svg className="h-4 w-4 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                              </svg>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {byOthers ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <select
                              value={f.procurementStatus}
                              onChange={(e) => handleStatusChange(f, "procurementStatus", e.target.value)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${PROCUREMENT_COLORS[f.procurementStatus]}`}
                            >
                              {PROCUREMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {byOthers ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <select
                              value={f.submittalStatus}
                              onChange={(e) => handleStatusChange(f, "submittalStatus", e.target.value)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${SUBMITTAL_COLORS[f.submittalStatus]}`}
                            >
                              {SUBMITTAL_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {!byOthers && (
                            <button
                              type="button"
                              onClick={() => setSelectedFixture(f)}
                              className="rounded p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit fixture details"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.629-.629z" />
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <FixtureDetailDrawer
        fixture={selectedFixture}
        onClose={() => setSelectedFixture(null)}
      />

      {/* Spec sheet library modal */}
      <SpecSheetLibraryModal
        open={showSpecLibrary}
        onClose={() => setShowSpecLibrary(false)}
      />
    </AppShell>
  );
}
