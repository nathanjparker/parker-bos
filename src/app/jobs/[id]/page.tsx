"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db, getFirebaseAuth } from "@/lib/firebase";
import {
  ACTIVITY_TAGS,
  PHASE_BADGE_CLASS,
  type ActivityEntry,
  type ActivityTag,
  type Job,
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

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "Jobs", id), (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...(snap.data() as Omit<Job, "id">) });
      }
      setLoading(false);
    });
    return () => unsub();
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
      </div>
    </AppShell>
  );
}
