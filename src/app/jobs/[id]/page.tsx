"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import BudgetImport from "@/components/BudgetImport";
import FileList from "@/components/FileList";
import FileUpload from "@/components/FileUpload";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { calcBillable, type CostingPhase } from "@/types/costing";
import {
  ACTIVITY_TAGS,
  PHASE_BADGE_CLASS,
  type ActivityEntry,
  type ActivityTag,
  type Job,
} from "@/types/jobs";
import {
  CATEGORIES_BY_PHASE,
  defaultFilePhaseForJob,
  JOB_FILE_PHASES,
  type JobFileCategory,
  type JobFilePhase,
} from "@/types/files";

function formatCurrency(n: number | undefined): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState<ActivityTag>("General");
  const [addingNote, setAddingNote] = useState(false);
  const [activePhase, setActivePhase] = useState<JobFilePhase>("Active");
  const [activeCategory, setActiveCategory] = useState<JobFileCategory>("Schedule");
  const [costingPhases, setCostingPhases] = useState<CostingPhase[]>([]);
  const [showBudgetImport, setShowBudgetImport] = useState(false);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  const filePhaseInitializedForJobId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    filePhaseInitializedForJobId.current = null;
    const unsub = onSnapshot(doc(db, "Jobs", id), (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...(snap.data() as Omit<Job, "id">) });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // Default file phase and category from job phase when job first loads
  useEffect(() => {
    if (!job || !id || filePhaseInitializedForJobId.current === id) return;
    filePhaseInitializedForJobId.current = id;
    const phase = defaultFilePhaseForJob(job.projectPhase);
    const categories = CATEGORIES_BY_PHASE[phase];
    setActivePhase(phase);
    setActiveCategory(categories[0] ?? "Schedule");
  }, [id, job]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "costingPhases"),
      where("jobId", "==", id),
      orderBy("importedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setCostingPhases(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostingPhase, "id">) }))
      );
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "Jobs", id, "activity"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivity(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityEntry, "id">),
        }))
      );
    });
    return () => unsub();
  }, [id]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || !id) return;
    setAddingNote(true);
    try {
      const user = auth?.currentUser;
      await addDoc(collection(db, "Jobs", id, "activity"), {
        text: noteText.trim(),
        tag: noteTag,
        createdAt: serverTimestamp(),
        createdBy: user?.email ?? "unknown",
        createdByName: user?.displayName ?? user?.email ?? "Unknown",
      });
      setNoteText("");
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-500">Job not found.</p>
          <Link
            href="/jobs"
            className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
          >
            Back to Jobs
          </Link>
        </div>
      </AppShell>
    );
  }

  const fullAddress = [
    job.siteAddress,
    job.siteCity,
    job.siteState,
    job.siteZip,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/jobs"
              className="text-xs font-semibold text-gray-400 hover:text-gray-600"
            >
              ← Jobs
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              {job.jobName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  PHASE_BADGE_CLASS[job.projectPhase]
                }`}
              >
                {job.projectPhase}
              </span>
              {job.gcName && (
                <span className="text-sm text-gray-500">{job.gcName}</span>
              )}
            </div>
          </div>
          <Link
            href={`/jobs/${job.id}/edit`}
            className="self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Edit
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Left column — details */}
          <div className="space-y-6 lg:col-span-1">
            {/* Contract */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Contract
              </h2>
              <dl className="space-y-3">
                <InfoRow
                  label="Original Value"
                  value={formatCurrency(job.originalContractValue)}
                />
                <InfoRow
                  label="Current Value"
                  value={formatCurrency(job.currentContractValue)}
                />
              </dl>
            </div>

            {/* Site */}
            {fullAddress && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Site
                </h2>
                <p className="text-sm text-gray-900">{fullAddress}</p>
              </div>
            )}

            {/* Team */}
            {(job.estimatorName || job.pmName || job.superintendentName) && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Team
                </h2>
                <dl className="space-y-3">
                  <InfoRow label="Estimator" value={job.estimatorName} />
                  <InfoRow label="Project Manager" value={job.pmName} />
                  <InfoRow label="Superintendent" value={job.superintendentName} />
                </dl>
              </div>
            )}
          </div>

          {/* Right column — activity */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Activity Log
                </h2>
              </div>

              {/* Add note */}
              <form onSubmit={handleAddNote} className="border-b border-gray-100 px-5 py-4">
                <textarea
                  rows={3}
                  placeholder="Add a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={noteTag}
                    onChange={(e) => setNoteTag(e.target.value as ActivityTag)}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ACTIVITY_TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!noteText.trim() || addingNote}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {addingNote ? "Adding…" : "Add Note"}
                  </button>
                </div>
              </form>

              {/* Notes feed */}
              <div className="divide-y divide-gray-100">
                {activity.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">
                    No activity yet.
                  </p>
                ) : (
                  activity.map((entry) => (
                    <div key={entry.id} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {entry.tag && entry.tag !== "General" && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            {entry.tag}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {entry.createdAt
                            ? entry.createdAt.toDate().toLocaleString()
                            : "Pending…"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          &middot; {entry.createdByName || entry.createdBy}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-800">
                        {entry.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Files */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Files</h2>
          </div>
          {/* Phase header: Bidding | Awarded | Active | Close out */}
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">
            {JOB_FILE_PHASES.map((phase) => (
              <button
                key={phase}
                type="button"
                onClick={() => {
                  setActivePhase(phase);
                  const cats = CATEGORIES_BY_PHASE[phase];
                  const inPhase = cats.includes(activeCategory);
                  if (!inPhase) setActiveCategory(cats[0] ?? "Schedule");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activePhase === phase
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {phase}
              </button>
            ))}
          </div>
          {/* Category tabs for current phase */}
          <div className="flex flex-wrap gap-1 border-b border-gray-100 px-5 py-3">
            {CATEGORIES_BY_PHASE[activePhase].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* File list + upload for active category */}
          <div className="px-5 py-4">
            <div className="mb-3">
              <FileUpload
                entityType="job"
                entityId={id}
                entityName={job.jobName}
                category={activeCategory}
                label={`Upload ${activeCategory}`}
              />
            </div>
            <FileList
              entityType="job"
              entityId={id}
              entityName={job.jobName}
              category={activeCategory}
            />
          </div>
        </div>

        {/* Budget / Costing — Awarded and Active jobs only */}
        {(job.projectPhase === "Awarded" || job.projectPhase === "Active") && (() => {
          const contracted = costingPhases.filter((p) => p.subgrouping === "CONTRACTED WORK");
          const cos = costingPhases.filter((p) => p.subgrouping === "CHANGE ORDER");
          const totalContract = costingPhases.reduce((s, p) => s + p.contractValue, 0);
          const totalBillable = costingPhases.reduce((s, p) => s + calcBillable(p.contractValue, p.completedPct), 0);

          return (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-semibold text-gray-900">Budget</h2>
                  {costingPhases.length > 0 && (
                    <>
                      <span className="text-xs text-gray-500">
                        Contract: <span className="font-semibold text-gray-800">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalContract)}
                        </span>
                      </span>
                      <span className="text-xs text-gray-500">
                        Billable: <span className="font-semibold text-green-700">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalBillable)}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {costingPhases.length > 0 && (
                    <Link
                      href="/project-management"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View in Project Management →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowBudgetImport(true)}
                    className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    {costingPhases.length > 0 ? "Re-import Budget" : "+ Import Budget"}
                  </button>
                </div>
              </div>

              {costingPhases.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-gray-400">No budget imported yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowBudgetImport(true)}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Import Budget
                  </button>
                </div>
              ) : (
                <div className="px-5 py-4 space-y-4">
                  {contracted.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Contracted Work</p>
                      <BudgetPhaseTable phases={contracted} />
                    </div>
                  )}
                  {cos.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Change Orders</p>
                      <BudgetPhaseTable phases={cos} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {showBudgetImport && job && (
        <BudgetImport
          jobId={id}
          jobName={job.jobName}
          existingPhases={costingPhases}
          onClose={() => setShowBudgetImport(false)}
        />
      )}
    </AppShell>
  );
}

function BudgetPhaseTable({ phases }: { phases: CostingPhase[] }) {
  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            {["Phase", "Est. Mat", "Est. Labor", "Est. Hrs", "Contract", "% Complete", "Hrs Left", "Billable"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {phases.map((p) => {
            const hoursLeft = Math.round(p.estHours * (1 - (p.completedPct ?? 0) / 100));
            const billable = calcBillable(p.contractValue, p.completedPct);
            const complete = p.completedPct === 100;
            return (
              <tr key={p.id} className={complete ? "bg-green-100" : ""}>
                <td className={`px-3 py-2 font-medium ${complete ? "text-green-800" : "text-gray-900"}`}>
                  {p.label}
                </td>
                <td className={`px-3 py-2 tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{fmt(p.estMaterialCost)}</td>
                <td className={`px-3 py-2 tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{fmt(p.estLaborCost)}</td>
                <td className={`px-3 py-2 tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{p.estHours}</td>
                <td className={`px-3 py-2 font-medium tabular-nums ${complete ? "text-green-800" : "text-gray-900"}`}>{fmt(p.contractValue)}</td>
                <td className={`px-3 py-2 tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{p.completedPct != null ? `${p.completedPct}%` : "—"}</td>
                <td className={`px-3 py-2 tabular-nums ${hoursLeft < 0 ? "text-red-600 font-semibold" : complete ? "text-green-700" : "text-gray-600"}`}>
                  {p.estHours > 0 ? hoursLeft : "—"}
                </td>
                <td className={`px-3 py-2 font-medium tabular-nums ${complete ? "text-green-800" : "text-green-700"}`}>{fmt(billable)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
