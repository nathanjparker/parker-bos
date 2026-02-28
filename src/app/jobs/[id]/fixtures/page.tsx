"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { Timestamp } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db, storage } from "@/lib/firebase";
import type { Job } from "@/types/jobs";
import {
  getFixtureCategory,
  isParkerItem,
  getPhaseLabel,
  normalizeAttachments,
  PROCUREMENT_STATUSES,
  SUBMITTAL_STATUSES,
  PROCUREMENT_COLORS,
  SUBMITTAL_COLORS,
  PHASE_BADGE_COLORS,
  type FixtureAttachment,
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

/** Get the first viewable PDF URL for a fixture (spec library, specSheetUrl, or spec sheet attachment) */
function getSpecPdfUrl(f: JobFixture): string | null {
  // Legacy direct spec sheet URL
  if (f.specSheetUrl) return f.specSheetUrl;
  // Spec sheet type attachment
  const specAtt = (f.attachments ?? []).find(
    (a) => typeof a === "object" && a.type === "Spec Sheet"
  );
  if (specAtt && typeof specAtt === "object") return specAtt.url;
  return null;
}

/** Check if fixture has any spec indicator (library link, specSheetUrl, or spec sheet attachment) */
function hasSpec(f: JobFixture): boolean {
  if (f.specSheetLibraryId) return true;
  if (f.specSheetUrl) return true;
  if ((f.attachments ?? []).some((a) => typeof a === "object" && a.type === "Spec Sheet")) return true;
  return false;
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
  // By Others attachment panel
  const [byOthersFixture, setByOthersFixture] = useState<JobFixture | null>(null);

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

  // Load fixtures (normalize attachments for backwards compatibility)
  useEffect(() => {
    if (!jobId) return;
    const q = query(
      collection(db, "jobFixtures"),
      where("jobId", "==", jobId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<JobFixture, "id">;
          return {
            ...raw,
            id: d.id,
            attachments: normalizeAttachments(raw.attachments),
            specSheetLibraryId: raw.specSheetLibraryId ?? null,
          } as JobFixture;
        })
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

  function handleRowClick(f: JobFixture) {
    const byOthers = !isParkerItem(f.materialGroup);
    if (byOthers) return; // By Others rows don't open the full drawer
    setSelectedFixture(f);
  }

  function handleSpecClick(e: React.MouseEvent, f: JobFixture) {
    e.stopPropagation(); // Don't open drawer
    // If spec library linked, we need to find the PDF URL from spec column or attachments
    const pdfUrl = getSpecPdfUrl(f);
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  }

  // Keep drawer in sync with latest fixture data
  useEffect(() => {
    if (!selectedFixture) return;
    const updated = fixtures.find((f) => f.id === selectedFixture.id);
    if (updated) setSelectedFixture(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures]);

  // Keep By Others panel in sync
  useEffect(() => {
    if (!byOthersFixture) return;
    const updated = fixtures.find((f) => f.id === byOthersFixture.id);
    if (updated) setByOthersFixture(updated);
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
                {job?.jobName ?? "..."}
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
            placeholder="Search description, manufacturer, model..."
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
            <div className="py-16 text-center text-sm text-gray-400">Loading...</div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((f) => {
                    const byOthers = getFixtureCategory(f.materialGroup) === "By Others";
                    const phaseBadge = PHASE_BADGE_COLORS[f.costCode] ?? "bg-gray-100 text-gray-600";
                    const hasAttachments = (f.attachments ?? []).length > 0;
                    const specLinked = hasSpec(f);
                    const specPdfUrl = getSpecPdfUrl(f);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => handleRowClick(f)}
                        className={`group ${byOthers ? "opacity-60" : "cursor-pointer hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {byOthers ? (
                            <span className="text-xs text-gray-400">By Others</span>
                          ) : (
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${phaseBadge}`}>
                              {getPhaseLabel(f.costCode)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{f.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">{f.size ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-800 max-w-xs">
                          <div className="truncate" title={f.description}>{f.description}</div>
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
                          {byOthers ? (
                            // By Others: show paperclip if attachments exist
                            hasAttachments ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setByOthersFixture(f); }}
                                title="View attachments"
                                className="inline-flex text-gray-400 hover:text-gray-600"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )
                          ) : (
                            // Parker items: spec icon
                            specLinked ? (
                              specPdfUrl ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleSpecClick(e, f)}
                                  title="View spec sheet"
                                  className="inline-flex text-green-600 hover:text-green-700"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="inline-flex text-green-400" title="Spec linked (no PDF URL)">
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                                  </svg>
                                </span>
                              )
                            ) : (
                              <span className="text-gray-300">
                                <svg className="h-4 w-4 inline" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                                </svg>
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {byOthers ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <select
                              value={f.procurementStatus}
                              onClick={(e) => e.stopPropagation()}
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
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleStatusChange(f, "submittalStatus", e.target.value)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${SUBMITTAL_COLORS[f.submittalStatus]}`}
                            >
                              {SUBMITTAL_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
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

      {/* By Others attachment panel */}
      {byOthersFixture && (
        <ByOthersAttachmentPanel
          fixture={byOthersFixture}
          onClose={() => setByOthersFixture(null)}
        />
      )}

      {/* Spec sheet library modal */}
      <SpecSheetLibraryModal
        open={showSpecLibrary}
        onClose={() => setShowSpecLibrary(false)}
      />
    </AppShell>
  );
}

// ── By Others Attachment Panel ───────────────────────────────────────────────

function ByOthersAttachmentPanel({ fixture, onClose }: { fixture: JobFixture; onClose: () => void }) {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    const currentCount = fixture.attachments?.length ?? 0;
    if (currentCount >= 3) {
      setUploadError("Maximum 3 attachments.");
      return;
    }
    setUploadError("");
    setUploadProgress(0);

    const storagePath = `attachments/${fixture.jobId}/${fixture.id}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => {
        setUploadError("Upload failed.");
        setUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const newAtt: FixtureAttachment = {
          url,
          filename: file.name,
          type: "Other",
          uploadedAt: Timestamp.now(),
          storagePath,
        };
        const current = fixture.attachments ?? [];
        await updateDoc(doc(db, "jobFixtures", fixture.id), {
          attachments: [...current, newAtt],
          updatedAt: serverTimestamp(),
        });
        setUploadProgress(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">By Others</p>
            <h2 className="text-base font-semibold text-gray-900">{fixture.description}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Qty {fixture.quantity}{fixture.size ? ` · ${fixture.size}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Attachments ({fixture.attachments?.length ?? 0}/3)
          </h3>

          {(fixture.attachments ?? []).length > 0 && (
            <ul className="space-y-2">
              {(fixture.attachments ?? []).map((att, i) => (
                <li key={att.url || i} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                  <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                  </svg>
                  <span className="text-sm text-gray-800 truncate flex-1">{att.filename || "File"}</span>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}

          {(fixture.attachments?.length ?? 0) < 3 && (
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
                className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100"
              />
              {uploadProgress !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {uploadProgress}%
                </div>
              )}
            </div>
          )}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
