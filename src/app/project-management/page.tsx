"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import BudgetImport from "@/components/BudgetImport";
import { db } from "@/lib/firebase";
import { calcBillable, type CostingPhase } from "@/types/costing";
import { PHASE_BADGE_CLASS, type Job } from "@/types/jobs";

type PhaseFilter = "Both" | "Awarded" | "Active" | "Install";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Always-visible input that looks like plain text until focused */
function InlineInput({
  value,
  type = "number",
  onSave,
}: {
  value: number | string | null | undefined;
  type?: "number" | "text";
  onSave: (val: string) => void;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const [focused, setFocused] = useState(false);

  // Sync from Firestore only when not actively editing
  useEffect(() => {
    if (!focused) setLocal(value != null ? String(value) : "");
  }, [value, focused]);

  function handleBlur() {
    setFocused(false);
    const original = value != null ? String(value) : "";
    if (local !== original) onSave(local);
  }

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") {
          setLocal(value != null ? String(value) : "");
          e.currentTarget.blur();
        }
      }}
      placeholder="—"
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-gray-700 tabular-nums placeholder:text-gray-300 hover:border-gray-300 hover:bg-gray-50 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

/** Popup rich-text notes editor */
function NotesModal({
  phaseLabel,
  initialValue,
  onSave,
  onClose,
}: {
  phaseLabel: string;
  initialValue: string;
  onSave: (html: string) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Set initial content and focus on mount only
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = initialValue || "";
    el.focus();
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    if (sel) {
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use onMouseDown + preventDefault on toolbar buttons so editor keeps focus
  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  function handleSave() {
    const el = editorRef.current;
    if (!el) return;
    // Sync checkbox checked states to HTML attributes before reading innerHTML
    el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) cb.setAttribute("checked", "checked");
      else cb.removeAttribute("checked");
    });
    const html = el.innerHTML ?? "";
    const hasContent =
      html.replace(/<[^>]+>/g, "").trim().length > 0 ||
      el.querySelector('input[type="checkbox"]') !== null;
    onSave(hasContent ? html : "");
    onClose();
  }

  const btnCls =
    "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors select-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Scoped styles for the rich-text editor content */}
      <style>{`
        .notes-rt-editor ul{list-style:disc;padding-left:1.25rem}
        .notes-rt-editor ol{list-style:decimal;padding-left:1.25rem}
        .notes-rt-editor li{margin:0.125rem 0}
        .notes-rt-editor input[type=checkbox]{margin-right:0.375rem;cursor:pointer;width:0.875rem;height:0.875rem;vertical-align:middle}
        .notes-rt-editor b,.notes-rt-editor strong{font-weight:600}
        .notes-rt-editor i,.notes-rt-editor em{font-style:italic}
        .notes-rt-editor p{margin:0}
        .notes-rt-editor div{min-height:1.25em}
      `}</style>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Notes — {phaseLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-gray-100 bg-gray-50 px-3 py-2 shrink-0">
          <button
            type="button"
            className={btnCls}
            title="Bold"
            onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={btnCls}
            title="Italic"
            onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }}
          >
            <em>I</em>
          </button>
          <div className="mx-2 h-4 w-px bg-gray-300" />
          <button
            type="button"
            className={btnCls}
            title="Bullet list"
            onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 5a1 1 0 100-2 1 1 0 000 2zm0 6a1 1 0 100-2 1 1 0 000 2zm0 6a1 1 0 100-2 1 1 0 000 2zM8 4a1 1 0 000 2h9a1 1 0 100-2H8zm0 6a1 1 0 000 2h9a1 1 0 100-2H8zm0 6a1 1 0 000 2h9a1 1 0 100-2H8z" />
            </svg>
            Bullets
          </button>
          <button
            type="button"
            className={btnCls}
            title="Numbered list"
            onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 100 2h.01a1 1 0 100-2H3zm0 6a1 1 0 100 2h.01a1 1 0 100-2H3zm0 6a1 1 0 100 2h.01a1 1 0 100-2H3zM8 4a1 1 0 000 2h9a1 1 0 100-2H8zm0 6a1 1 0 000 2h9a1 1 0 100-2H8zm0 6a1 1 0 000 2h9a1 1 0 100-2H8z" clipRule="evenodd" />
            </svg>
            Numbered
          </button>
          <button
            type="button"
            className={btnCls}
            title="Checklist item"
            onMouseDown={(e) => {
              e.preventDefault();
              execCmd("insertHTML", "<div><input type=\"checkbox\">&nbsp;</div>");
            }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Checklist
          </button>
        </div>

        {/* Editable content area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="notes-rt-editor min-h-[180px] max-h-[400px] overflow-y-auto px-5 py-4 text-sm text-gray-900 focus:outline-none"
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

/** Notes cell — shows truncated preview, opens modal on click */
function NotesCell({
  phase,
  onUpdate,
}: {
  phase: CostingPhase;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const note = phase.notes ?? "";
  // Strip HTML tags for plain-text preview
  const plainText = note.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full text-left rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-blue-50 hover:text-blue-700 ${
          note ? "text-gray-700" : "text-gray-300"
        }`}
        title={plainText || "Add note"}
      >
        {note ? (
          <span className="block truncate max-w-[160px]">{plainText}</span>
        ) : (
          "+ Add note"
        )}
      </button>
      {open && (
        <NotesModal
          phaseLabel={`${phase.costCode} ${phase.label}`}
          initialValue={note}
          onSave={(html) => onUpdate(phase.id, "notes", html || null)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PhaseTable({
  phases,
  onUpdate,
}: {
  phases: CostingPhase[];
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {[
              "Phase", "Est. Mat", "Est. Labor", "Est. Hrs",
              "Contract", "Actual Mat", "Actual Hrs", "%",
              "Hrs Left", "Billable", "Notes",
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {phases.map((p) => {
            const hoursLeft = Math.round(p.estHours * (1 - (p.completedPct ?? 0) / 100));
            const billable = calcBillable(p.contractValue, p.completedPct);
            const complete = p.completedPct === 100;
            return (
              <tr key={p.id} className={complete ? "bg-green-100 hover:bg-green-100" : "hover:bg-gray-50/50"}>
                <td className={`px-3 py-2 font-medium whitespace-nowrap ${complete ? "text-green-800" : "text-gray-900"}`}>
                  {p.subgrouping === "CHANGE ORDER" && (
                    <span className={`mr-1.5 text-[11px] font-semibold ${complete ? "text-green-500" : "text-gray-400"}`}>
                      {p.costCode.replace(/^CO-/i, "")}
                    </span>
                  )}
                  {p.label}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{fmt(p.estMaterialCost)}</td>
                <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{fmt(p.estLaborCost)}</td>
                <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${complete ? "text-green-700" : "text-gray-600"}`}>{p.estHours}</td>
                <td className={`px-3 py-2 font-medium whitespace-nowrap tabular-nums ${complete ? "text-green-800" : "text-gray-900"}`}>{fmt(p.contractValue)}</td>
                <td className="px-3 py-2 min-w-[90px]">
                  <InlineInput
                    value={p.actualMaterials}
                    type="number"
                    onSave={(v) => onUpdate(p.id, "actualMaterials", v === "" ? null : Number(v))}
                  />
                </td>
                <td className="px-3 py-2 min-w-[80px]">
                  <InlineInput
                    value={p.actualHours}
                    type="number"
                    onSave={(v) => onUpdate(p.id, "actualHours", v === "" ? null : Number(v))}
                  />
                </td>
                <td className="px-3 py-2 min-w-[64px]">
                  <InlineInput
                    value={p.completedPct}
                    type="number"
                    onSave={(v) => onUpdate(p.id, "completedPct", v === "" ? null : Math.min(100, Math.max(0, Number(v))))}
                  />
                </td>
                <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${hoursLeft < 0 ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                  {p.estHours > 0 ? hoursLeft : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-medium text-green-700 tabular-nums">
                  {fmt(billable)}
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <NotesCell phase={p} onUpdate={onUpdate} />
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Totals row */}
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
            <td className="px-3 py-2 font-semibold text-gray-700 tabular-nums">{fmt(phases.reduce((s, p) => s + p.estMaterialCost, 0))}</td>
            <td className="px-3 py-2 font-semibold text-gray-700 tabular-nums">{fmt(phases.reduce((s, p) => s + p.estLaborCost, 0))}</td>
            <td className="px-3 py-2 font-semibold text-gray-700 tabular-nums">{phases.reduce((s, p) => s + p.estHours, 0)}</td>
            <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{fmt(phases.reduce((s, p) => s + p.contractValue, 0))}</td>
            <td className="px-3 py-2 font-semibold text-gray-700 tabular-nums">
              {fmt(phases.reduce((s, p) => s + (p.actualMaterials ?? 0), 0))}
            </td>
            <td className="px-3 py-2 font-semibold text-gray-700 tabular-nums">
              {phases.reduce((s, p) => s + (p.actualHours ?? 0), 0)}
            </td>
            <td colSpan={2} />
            <td className="px-3 py-2 font-semibold text-green-700 tabular-nums">
              {fmt(phases.reduce((s, p) => s + calcBillable(p.contractValue, p.completedPct), 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ProjectManagementPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phases, setPhases] = useState<CostingPhase[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("Both");
  const [importJobId, setImportJobId] = useState<string | null>(null);

  // Listen to Awarded, Active, and Install jobs (all tracked in PM)
  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "in", ["Awarded", "Active", "Install"]),
      orderBy("jobName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) })));
      setLoadingJobs(false);
    });
  }, []);

  // Listen to costingPhases for all loaded jobs (batched if needed)
  useEffect(() => {
    if (jobs.length === 0) {
      setPhases([]);
      return;
    }
    const jobIds = jobs.map((j) => j.id);
    // Firestore "in" supports up to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < jobIds.length; i += 30) chunks.push(jobIds.slice(i, i + 30));

    const unsubs: (() => void)[] = [];
    const phasesByChunk: Map<number, CostingPhase[]> = new Map();

    chunks.forEach((chunk, idx) => {
      const q = query(
        collection(db, "costingPhases"),
        where("jobId", "in", chunk),
        orderBy("importedAt", "asc")
      );
      const unsub = onSnapshot(q, (snap) => {
        phasesByChunk.set(
          idx,
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostingPhase, "id">) }))
        );
        setPhases(Array.from(phasesByChunk.values()).flat());
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [jobs]);

  async function handleUpdate(phaseId: string, field: string, value: unknown) {
    try {
      await updateDoc(doc(db, "costingPhases", phaseId), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to update phase:", err);
    }
  }

  const filteredJobs = useMemo(() => {
    if (phaseFilter === "Both") return jobs;
    return jobs.filter((j) => j.projectPhase === phaseFilter);
  }, [jobs, phaseFilter]);

  const phasesByJob = useMemo(() => {
    const map = new Map<string, CostingPhase[]>();
    for (const p of phases) {
      if (!map.has(p.jobId)) map.set(p.jobId, []);
      map.get(p.jobId)!.push(p);
    }
    return map;
  }, [phases]);

  const totals = useMemo(() => {
    const relevantJobIds = new Set(filteredJobs.map((j) => j.id));
    const relevantPhases = phases.filter((p) => relevantJobIds.has(p.jobId));
    return {
      contract: relevantPhases.reduce((s, p) => s + p.contractValue, 0),
      billable: relevantPhases.reduce((s, p) => s + calcBillable(p.contractValue, p.completedPct), 0),
    };
  }, [filteredJobs, phases]);

  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set());
  const hasInitialCollapseRef = useRef(false);

  useEffect(() => {
    if (filteredJobs.length > 0 && !hasInitialCollapseRef.current) {
      hasInitialCollapseRef.current = true;
      setCollapsedJobs(new Set(filteredJobs.map((j) => j.id)));
    }
  }, [filteredJobs]);

  function toggleJob(id: string) {
    setCollapsedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allCollapsed =
    filteredJobs.length > 0 && filteredJobs.every((j) => collapsedJobs.has(j.id));

  function toggleAll() {
    if (allCollapsed) {
      setCollapsedJobs(new Set());
    } else {
      setCollapsedJobs(new Set(filteredJobs.map((j) => j.id)));
    }
  }

  const importJob = importJobId ? jobs.find((j) => j.id === importJobId) : null;
  const importExistingPhases = importJobId ? (phasesByJob.get(importJobId) ?? []) : [];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
            <p className="mt-1 text-sm text-gray-600">
              Job costing and phase tracking across active projects.
            </p>
          </div>
          {phases.length > 0 && (
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Total Contract</span>
                <p className="font-semibold text-gray-900">{fmt(totals.contract)}</p>
              </div>
              <div>
                <span className="text-gray-500">Total Billable</span>
                <p className="font-semibold text-green-700">{fmt(totals.billable)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filter tabs + collapse all */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            {(["Both", "Awarded", "Active", "Install"] as PhaseFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPhaseFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  phaseFilter === f
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {filteredJobs.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              {allCollapsed ? "Expand All" : "Collapse All"}
            </button>
          )}
        </div>

        {/* Job list */}
        <div className="mt-4 space-y-2">
          {loadingJobs ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm">
              No {phaseFilter === "Both" ? "Awarded, Active, or Install" : phaseFilter} jobs found.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const jobPhases = phasesByJob.get(job.id) ?? [];
              const contracted = jobPhases.filter((p) => p.subgrouping === "CONTRACTED WORK");
              const cos = jobPhases.filter((p) => p.subgrouping === "CHANGE ORDER");
              const fixturePhases = jobPhases.filter((p) => p.subgrouping === "FIXTURE");
              const jobContract = jobPhases.reduce((s, p) => s + p.contractValue, 0);
              const jobBillable = jobPhases.reduce((s, p) => s + calcBillable(p.contractValue, p.completedPct), 0);
              const collapsed = collapsedJobs.has(job.id);

              return (
                <div key={job.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  {/* Job header — click chevron area to collapse */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Chevron toggle */}
                      <button
                        type="button"
                        onClick={() => toggleJob(job.id)}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        aria-label={collapsed ? "Expand" : "Collapse"}
                      >
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate"
                      >
                        {job.jobName}
                      </Link>
                      <span
                        className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          PHASE_BADGE_CLASS[job.projectPhase]
                        }`}
                      >
                        {job.projectPhase}
                      </span>
                      {jobPhases.length > 0 && (
                        <>
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            Contract: <span className="font-medium text-gray-700">{fmt(jobContract)}</span>
                          </span>
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            Billable: <span className="font-medium text-green-700">{fmt(jobBillable)}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportJobId(job.id)}
                      className="shrink-0 rounded border border-dashed border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      {jobPhases.length > 0 ? "Re-import" : "+ Import Budget"}
                    </button>
                  </div>

                  {!collapsed && (
                    jobPhases.length === 0 ? (
                      <div className="border-t border-gray-100 px-5 py-4 text-center text-sm text-gray-400">
                        No budget imported.{" "}
                        <button
                          type="button"
                          onClick={() => setImportJobId(job.id)}
                          className="text-blue-600 hover:underline"
                        >
                          Import now
                        </button>
                      </div>
                    ) : (
                      <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                        {contracted.length > 0 && (
                          <div>
                            {cos.length > 0 && (
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                Contracted Work
                              </p>
                            )}
                            <PhaseTable phases={contracted} onUpdate={handleUpdate} />
                          </div>
                        )}
                        {cos.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                              Change Orders
                            </p>
                            <PhaseTable phases={cos} onUpdate={handleUpdate} />
                          </div>
                        )}
                        {fixturePhases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                              Fixtures
                            </p>
                            <PhaseTable phases={fixturePhases} onUpdate={handleUpdate} />
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {importJobId && importJob && (
        <BudgetImport
          jobId={importJobId}
          jobName={importJob.jobName}
          existingPhases={importExistingPhases}
          onClose={() => setImportJobId(null)}
        />
      )}
    </AppShell>
  );
}
