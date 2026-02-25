"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CostCode } from "@/types/costCodes";
import type { ServiceEstimate } from "@/types/estimates";
import type { Job } from "@/types/jobs";
import {
  calcConstructionRollup,
  parseFastPipeTSV,
  type ConstructionEstimatePhase,
  type ConstructionFixture,
  type ParsedFastPipeRow,
} from "@/types/constructionEstimate";
import { parseBudgetTSV } from "@/types/costing";

interface Props {
  estimateId?: string;
}

interface LocalFixture {
  id?: string;
  estimateId: string;
  costCode: string;
  materialGroup: string;
  quantity: number;
  size: string | null;
  description: string;
  sortOrder: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ConstructionEstimateBuilder({ estimateId }: Props) {
  const router = useRouter();

  // Resolved estimate ID — set when new doc is created
  const resolvedIdRef = useRef<string | undefined>(estimateId);
  const [resolvedId, setResolvedId] = useState<string | undefined>(estimateId);

  // Auto-save: dirty when narrative or header changed; debounced save + beforeunload
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Header
  const [jobName, setJobName] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [status, setStatus] = useState<ServiceEstimate["status"]>("Draft");

  // Narrative fields
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [clarifications, setClarifications] = useState("");

  // Phases (read-only after import)
  const [phases, setPhases] = useState<(ConstructionEstimatePhase & { id: string })[]>([]);

  // Fixtures
  const [fixtures, setFixtures] = useState<LocalFixture[]>([]);
  // Preview rows parsed from FastPipe paste (editable before confirming)
  const [fixturePreviewRows, setFixturePreviewRows] = useState<ParsedFastPipeRow[]>([]);

  // Cost codes for label map
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Job typeahead
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);

  // Import UI
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [showFixtureImport, setShowFixtureImport] = useState(false);
  const [fixtureImportText, setFixtureImportText] = useState("");
  const [importingFixtures, setImportingFixtures] = useState(false);

  // Actions
  const [loading, setLoading] = useState(!!estimateId);
  const [saving, setSaving] = useState(false);
  const [confirmOpportunity, setConfirmOpportunity] = useState(false);
  const [confirmAwarded, setConfirmAwarded] = useState(false);
  const [confirmLost, setConfirmLost] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Load cost codes (for label map in import)
  useEffect(() => {
    getDocs(query(collection(db, "costCodes"), orderBy("sortOrder", "asc")))
      .then((snap) =>
        setCostCodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostCode, "id">) })))
      )
      .catch(console.error);
  }, []);

  // Load jobs for typeahead
  useEffect(() => {
    getDocs(query(collection(db, "Jobs"), orderBy("jobName", "asc")))
      .then((snap) =>
        setAllJobs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) })))
      )
      .catch(console.error);
  }, []);

  // Load existing estimate + phases + fixtures
  useEffect(() => {
    if (!estimateId) return;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [estSnap, phasesSnap, fixturesSnap] = await Promise.all([
          getDoc(doc(db, "estimates", estimateId!)),
          getDocs(query(collection(db, "constructionEstimatePhases"), where("estimateId", "==", estimateId))),
          getDocs(query(collection(db, "constructionFixtures"), where("estimateId", "==", estimateId))),
        ]);

        if (!estSnap.exists()) {
          setError("Estimate not found.");
          setLoading(false);
          return;
        }

        const e = estSnap.data() as Omit<ServiceEstimate, "id">;
        setJobName(e.jobName ?? "");
        setJobSearch(e.jobName ?? "");
        setJobId(e.jobId);
        setStatus(e.status);
        setScopeOfWork(e.scopeOfWork ?? "");
        setExclusions(e.exclusions ?? "");
        setClarifications(e.clarifications ?? "");

        const phaseDocs = phasesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ConstructionEstimatePhase, "id">) }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setPhases(phaseDocs);

        const fixtureDocs = fixturesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ConstructionFixture, "id">) }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setFixtures(fixtureDocs);
      } catch (err) {
        console.error("Failed to load construction estimate:", err);
        setError("Failed to load estimate.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [estimateId]);

  const rollup = useMemo(() => calcConstructionRollup(phases), [phases]);

  const jobSuggestions = useMemo(() => {
    if (jobSearch.length < 2) return [];
    const q = jobSearch.toLowerCase();
    return allJobs.filter((j) => j.jobName.toLowerCase().includes(q)).slice(0, 8);
  }, [jobSearch, allJobs]);

  const importPreview = useMemo(() => {
    if (!importText.trim()) return [];
    const labelMap = new Map(costCodes.map((c) => [c.code, c.label]));
    try {
      return parseBudgetTSV(importText, labelMap);
    } catch {
      return [];
    }
  }, [importText, costCodes]);

  // Auto-parse FastPipe paste into preview rows
  useEffect(() => {
    setFixturePreviewRows(fixtureImportText.trim() ? parseFastPipeTSV(fixtureImportText) : []);
  }, [fixtureImportText]);

  // Group confirmed fixtures by cost code (sorted by sortOrder within each group)
  const fixturesByCode = useMemo(() => {
    const groups: Record<string, LocalFixture[]> = {};
    for (const f of fixtures) {
      if (!groups[f.costCode]) groups[f.costCode] = [];
      groups[f.costCode].push(f);
    }
    for (const g of Object.values(groups)) g.sort((a, b) => a.sortOrder - b.sortOrder);
    return groups;
  }, [fixtures]);

  const fixtureCostCodes = useMemo(() => Object.keys(fixturesByCode).sort(), [fixturesByCode]);

  // Create estimate doc lazily on first action
  async function ensureEstimateDoc(): Promise<string> {
    if (resolvedIdRef.current) return resolvedIdRef.current;
    const ref = await addDoc(collection(db, "estimates"), {
      type: "construction",
      jobName: jobName || "Untitled Construction Estimate",
      jobId: jobId ?? null,
      status: "Draft",
      laborRate: 0,
      laborBurden: 0,
      materialMarkup: 0,
      totalHours: 0,
      totalLaborBilling: 0,
      totalMaterialCost: 0,
      totalContractValue: 0,
      profitMargin: 0,
      scopeOfWork: "",
      exclusions: "",
      clarifications: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    resolvedIdRef.current = ref.id;
    setResolvedId(ref.id);
    window.history.replaceState(null, "", `/estimates/construction/${ref.id}`);
    return ref.id;
  }

  // Save rollup totals to estimate doc
  async function saveRollup(eid: string, currentPhases: typeof phases) {
    const r = calcConstructionRollup(currentPhases);
    await updateDoc(doc(db, "estimates", eid), {
      totalHours: r.totalHours,
      totalLaborBilling: r.totalLaborCost,
      totalMaterialCost: r.totalMaterialCost,
      totalContractValue: r.totalContractValue,
      profitMargin: 0,
      updatedAt: serverTimestamp(),
    });
  }

  async function saveHeader() {
    const eid = resolvedIdRef.current;
    if (!eid) return;
    try {
      await updateDoc(doc(db, "estimates", eid), {
        jobName: jobName || "Untitled Construction Estimate",
        jobId: jobId ?? null,
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      dirtyRef.current = false;
    } catch (err) {
      console.error("Failed to save header:", err);
    }
  }

  async function saveNarrative(field: "scopeOfWork" | "exclusions" | "clarifications", value: string) {
    const eid = resolvedIdRef.current;
    if (!eid) return;
    try {
      await updateDoc(doc(db, "estimates", eid), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      dirtyRef.current = false;
    } catch (err) {
      console.error("Failed to save narrative:", err);
    }
  }

  // Debounced auto-save when user has edited (dirty) and estimate exists
  const runAutoSaveRef = useRef<() => void>(() => {});
  runAutoSaveRef.current = async () => {
    const eid = resolvedIdRef.current;
    if (!eid || !dirtyRef.current) return;
    try {
      await updateDoc(doc(db, "estimates", eid), {
        jobName: jobName || "Untitled Construction Estimate",
        jobId: jobId ?? null,
        scopeOfWork: scopeOfWork,
        exclusions: exclusions,
        clarifications: clarifications,
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      dirtyRef.current = false;
      setError("");
    } catch (err) {
      console.error("Auto-save failed:", err);
      setError("Auto-save failed. Check your connection and try again.");
    }
  };

  useEffect(() => {
    if (!dirty || !resolvedId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      runAutoSaveRef.current();
    }, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dirty, resolvedId, jobName, jobId, scopeOfWork, exclusions, clarifications]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Import phases from TSV
  async function handleImportPhases() {
    if (importPreview.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const eid = await ensureEstimateDoc();

      // Delete all existing phases for this estimate
      const existing = await getDocs(
        query(collection(db, "constructionEstimatePhases"), where("estimateId", "==", eid))
      );
      await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));

      // Add new phases
      const newPhases = await Promise.all(
        importPreview.map((row, i) =>
          addDoc(collection(db, "constructionEstimatePhases"), {
            estimateId: eid,
            costCode: row.costCode,
            label: row.label,
            estMaterialCost: row.estMaterialCost,
            estLaborCost: row.estLaborCost,
            estHours: row.estHours,
            mMarkup: row.mMarkup,
            lMarkup: row.lMarkup,
            contractValue: row.contractValue,
            sortOrder: i + 1,
            importedAt: serverTimestamp(),
          })
        )
      );

      const loadedPhases = importPreview.map((row, i) => ({
        id: newPhases[i].id,
        estimateId: eid,
        costCode: row.costCode,
        label: row.label,
        estMaterialCost: row.estMaterialCost,
        estLaborCost: row.estLaborCost,
        estHours: row.estHours,
        mMarkup: row.mMarkup,
        lMarkup: row.lMarkup,
        contractValue: row.contractValue,
        sortOrder: i + 1,
        importedAt: null as unknown as ConstructionEstimatePhase["importedAt"],
      }));

      setPhases(loadedPhases);
      await saveRollup(eid, loadedPhases);
      setImportText("");
      setShowImport(false);
    } catch (err) {
      console.error("Import failed:", err);
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  // Fixtures CRUD
  async function handleDeleteFixture(id: string | undefined) {
    if (!id) return;
    setFixtures((prev) => prev.filter((f) => f.id !== id));
    await deleteDoc(doc(db, "constructionFixtures", id));
  }

  // Import FastPipe fixtures — replaces all existing fixtures for this estimate
  async function handleImportFastPipeFixtures() {
    if (fixturePreviewRows.length === 0) return;
    setImportingFixtures(true);
    setError("");
    try {
      const eid = await ensureEstimateDoc();

      // Delete all existing fixtures for this estimate
      const existing = await getDocs(
        query(collection(db, "constructionFixtures"), where("estimateId", "==", eid))
      );
      await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));

      // Write new fixtures
      const newFixtures: LocalFixture[] = [];
      for (let i = 0; i < fixturePreviewRows.length; i++) {
        const row = fixturePreviewRows[i];
        const sortOrder = i + 1;
        const ref = await addDoc(collection(db, "constructionFixtures"), {
          estimateId: eid,
          costCode: row.costCode,
          materialGroup: row.materialGroup,
          quantity: row.quantity,
          size: row.size,
          description: row.description,
          sortOrder,
        });
        newFixtures.push({
          id: ref.id,
          estimateId: eid,
          costCode: row.costCode,
          materialGroup: row.materialGroup,
          quantity: row.quantity,
          size: row.size,
          description: row.description,
          sortOrder,
        });
      }
      setFixtures(newFixtures);
      setFixturePreviewRows([]);
      setFixtureImportText("");
      setShowFixtureImport(false);
    } catch (err) {
      console.error("Fixture import failed:", err);
      setError("Fixture import failed. Please try again.");
    } finally {
      setImportingFixtures(false);
    }
  }

  // Mark Opportunity
  async function handleMarkOpportunity() {
    if (!resolvedId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "estimates", resolvedId), {
        status: "Opportunity",
        updatedAt: serverTimestamp(),
      });
      if (jobId) {
        await updateDoc(doc(db, "Jobs", jobId), {
          projectPhase: "Opportunity",
          updatedAt: serverTimestamp(),
        });
      }
      setStatus("Opportunity");
      setConfirmOpportunity(false);
    } catch (err) {
      console.error("Mark opportunity failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // Mark Awarded — push phases + fixtures to costingPhases, update job
  async function handleMarkAwarded() {
    if (!resolvedId) return;
    setSaving(true);
    setError("");
    try {
      if (jobId) {
        if (phases.length > 0) {
          await Promise.all(
            phases.map((phase) =>
              addDoc(collection(db, "costingPhases"), {
                jobId,
                jobName,
                costCode: phase.costCode,
                label: phase.label,
                subgrouping: "CONTRACTED WORK",
                estMaterialCost: phase.estMaterialCost,
                estLaborCost: phase.estLaborCost,
                estHours: phase.estHours,
                mMarkup: phase.mMarkup,
                lMarkup: phase.lMarkup,
                contractValue: phase.contractValue,
                importedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            )
          );
        }
        if (fixtures.length > 0) {
          await Promise.all(
            fixtures.map((f) =>
              addDoc(collection(db, "costingPhases"), {
                jobId,
                jobName,
                costCode: f.costCode,
                label: f.description || "Fixture",
                subgrouping: "FIXTURE",
                estMaterialCost: 0,
                estLaborCost: 0,
                estHours: 0,
                mMarkup: 0,
                lMarkup: 0,
                contractValue: 0,
                importedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            )
          );
        }
        await updateDoc(doc(db, "Jobs", jobId), {
          projectPhase: "Awarded",
          updatedAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, "estimates", resolvedId), {
        status: "Awarded",
        updatedAt: serverTimestamp(),
      });
      setStatus("Awarded");
      setConfirmAwarded(false);
      router.push("/estimates");
    } catch (err) {
      console.error("Mark awarded failed:", err);
      setError("Failed to mark as awarded. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Mark Lost
  async function handleMarkLost() {
    if (!resolvedId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "estimates", resolvedId), {
        status: "Lost",
        updatedAt: serverTimestamp(),
      });
      setStatus("Lost");
      setConfirmLost(false);
    } catch (err) {
      console.error("Mark lost failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // Delete entire construction estimate (estimate + phases + fixtures)
  async function handleDeleteEstimate() {
    const eid = resolvedIdRef.current;
    if (!eid) return;
    setDeleting(true);
    setError("");
    try {
      const [phasesSnap, fixturesSnap] = await Promise.all([
        getDocs(query(collection(db, "constructionEstimatePhases"), where("estimateId", "==", eid))),
        getDocs(query(collection(db, "constructionFixtures"), where("estimateId", "==", eid))),
      ]);
      await Promise.all(phasesSnap.docs.map((d) => deleteDoc(d.ref)));
      await Promise.all(fixturesSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "estimates", eid));
      setConfirmDelete(false);
      router.push("/estimates");
    } catch (err) {
      console.error("Failed to delete estimate:", err);
      setError("Failed to delete estimate. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Loading estimate…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Breadcrumb + Delete */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <a href="/estimates" className="hover:text-blue-600">Estimates</a>
          <span>/</span>
          <span className="text-gray-900 font-medium">{jobName || "New Construction Estimate"}</span>
        </div>
        {resolvedId && (
          confirmDelete ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
              <span className="text-red-800">Delete this estimate? This cannot be undone.</span>
              <button
                type="button"
                onClick={handleDeleteEstimate}
                disabled={deleting}
                className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete estimate
            </button>
          )
        )}
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Job typeahead */}
          <div className="relative flex-1 min-w-64">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Job Name</label>
            <input
              type="text"
              value={jobSearch}
              onChange={(e) => {
                setJobSearch(e.target.value);
                setJobName(e.target.value);
                setJobId(undefined);
                setShowJobSuggestions(true);
                setDirty(true);
                dirtyRef.current = true;
              }}
              onFocus={() => setShowJobSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowJobSuggestions(false), 150);
                saveHeader();
              }}
              placeholder="Type to search existing jobs or enter free text…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showJobSuggestions && jobSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                {jobSuggestions.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setJobName(j.jobName);
                      setJobSearch(j.jobName);
                      setJobId(j.id);
                      setShowJobSuggestions(false);
                      setDirty(true);
                      dirtyRef.current = true;
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-4"
                  >
                    <span className="font-medium text-gray-900">{j.jobName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{j.projectPhase}</span>
                  </button>
                ))}
              </div>
            )}
            {jobId && (
              <p className="mt-1 text-xs text-blue-600">
                Linked to job —{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => { setJobId(undefined); setJobSearch(jobName); }}
                >
                  unlink
                </button>
              </p>
            )}
          </div>

          {/* Type badge + Status */}
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Construction
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                status === "Draft"       ? "bg-gray-100 text-gray-700"
                : status === "Opportunity" ? "bg-orange-100 text-orange-700"
                : status === "Awarded"     ? "bg-green-100 text-green-700"
                :                           "bg-red-100 text-red-600"
              }`}>
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FastPIPE Import */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Budget Phases</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {phases.length > 0
                ? `${phases.length} phase${phases.length === 1 ? "" : "s"} imported`
                : "Paste FastPIPE TSV to import budget phases"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            {phases.length > 0 ? (showImport ? "Cancel" : "Re-import") : "Import TSV"}
          </button>
        </div>

        {/* Import area */}
        {showImport && (
          <div className="p-5 space-y-3 border-b border-gray-100">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder="Paste FastPIPE TSV data here…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {importPreview.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Preview — {importPreview.length} phase{importPreview.length === 1 ? "" : "s"}
                  {phases.length > 0 && (
                    <span className="ml-2 text-amber-600 normal-case font-normal">
                      (will replace existing {phases.length} phase{phases.length === 1 ? "" : "s"})
                    </span>
                  )}
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">Code</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">Label</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">Est. Mat</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">Est. Labor</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">Hours</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">Contract</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {importPreview.map((row) => (
                        <tr key={row.costCode}>
                          <td className="px-3 py-2 font-mono font-semibold text-gray-700">{row.costCode}</td>
                          <td className="px-3 py-2 text-gray-700">{row.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(row.estMaterialCost)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(row.estLaborCost)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{row.estHours.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{fmt(row.contractValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleImportPhases}
                    disabled={importing}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing ? "Importing…" : `Import ${importPreview.length} Phase${importPreview.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}
            {importText.trim() && importPreview.length === 0 && (
              <p className="text-xs text-amber-600">No valid rows found. Make sure columns are tab-separated: Code, Description, MatCost, LaborCost, MMarkup, LMarkup, Hours</p>
            )}
          </div>
        )}

        {/* Phases table */}
        {phases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Label</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Est. Mat</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Est. Labor</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Hrs</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">M%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">L%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {phases.map((phase) => (
                  <tr key={phase.id}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-700">{phase.costCode}</td>
                    <td className="px-4 py-2.5 text-gray-700">{phase.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{fmt(phase.estMaterialCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{fmt(phase.estLaborCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{phase.estHours.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 text-xs">{phase.mMarkup}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 text-xs">{phase.lMarkup}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(phase.contractValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {phases.length === 0 && !showImport && (
          <div className="py-10 text-center text-sm text-gray-400">
            No phases yet. Click &ldquo;Import TSV&rdquo; to get started.
          </div>
        )}
      </div>

      {/* Totals bar */}
      {phases.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-4">
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Hours</p>
              <p className="text-xl font-bold tabular-nums text-gray-900">
                {rollup.totalHours % 1 === 0 ? rollup.totalHours : rollup.totalHours.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Est. Labor</p>
              <p className="text-xl font-bold tabular-nums text-gray-900">{fmt(rollup.totalLaborCost)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Est. Materials</p>
              <p className="text-xl font-bold tabular-nums text-gray-900">{fmt(rollup.totalMaterialCost)}</p>
            </div>
            <div className="border-l border-gray-200 pl-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contract Value</p>
              <p className="text-3xl font-bold tabular-nums text-gray-900">{fmt(rollup.totalContractValue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Narrative sections */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
        {/* Scope of Work */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Scope of Work</label>
          <textarea
            value={scopeOfWork}
            onChange={(e) => {
              setScopeOfWork(e.target.value);
              setDirty(true);
              dirtyRef.current = true;
            }}
            onBlur={() => saveNarrative("scopeOfWork", scopeOfWork)}
            rows={6}
            placeholder="Describe the complete scope of work for this project…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Exclusions */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Exclusions</label>
          <textarea
            value={exclusions}
            onChange={(e) => {
              setExclusions(e.target.value);
              setDirty(true);
              dirtyRef.current = true;
            }}
            onBlur={() => saveNarrative("exclusions", exclusions)}
            rows={4}
            placeholder="List items specifically excluded from this estimate…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Clarifications */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Clarifications / Assumptions</label>
          <textarea
            value={clarifications}
            onChange={(e) => {
              setClarifications(e.target.value);
              setDirty(true);
              dirtyRef.current = true;
            }}
            onBlur={() => saveNarrative("clarifications", clarifications)}
            rows={4}
            placeholder="List any clarifications or assumptions made for this estimate…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>

      {/* Fixtures & Equipment */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Fixtures & Equipment</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fixtures.length > 0
                ? `${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"} imported`
                : "Paste FastPipe TSV to import fixture schedule"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFixtureImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            {fixtures.length > 0 ? (showFixtureImport ? "Cancel" : "Re-import") : (showFixtureImport ? "Cancel" : "Paste FastPipe")}
          </button>
        </div>

        {/* FastPipe paste zone */}
        {showFixtureImport && (
          <div className="p-5 space-y-3 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                Copy rows from FastPipe and paste below. Expected columns (tab-separated):{" "}
                <span className="font-mono">Material Group · Qty · Size · Description</span>
              </p>
              <textarea
                value={fixtureImportText}
                onChange={(e) => setFixtureImportText(e.target.value)}
                rows={6}
                placeholder={"01-FXT\t1\t½\tDW-BAR Dishwasher in Bar\n02-EQG\t6\t2\tFD Floor Drain\n03-FXT\t2\t<None>\tWC-1 Toilet - Floor Mt Tank Type"}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {fixturePreviewRows.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Preview — {fixturePreviewRows.length} fixture{fixturePreviewRows.length === 1 ? "" : "s"}
                  {fixtures.length > 0 && (
                    <span className="ml-2 text-amber-600 normal-case font-normal">
                      (will replace {fixtures.length} existing fixture{fixtures.length === 1 ? "" : "s"})
                    </span>
                  )}
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-64">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Cost Code</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Size</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Description</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {fixturePreviewRows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">
                            <span className="font-mono font-semibold text-gray-800">{row.costCode}</span>
                            <span className="ml-1.5 text-gray-400">{row.materialGroup}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{row.quantity}</td>
                          <td className="px-3 py-1.5 text-gray-600">{row.size ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-800">{row.description}</td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => setFixturePreviewRows((prev) => prev.filter((_, j) => j !== i))}
                              className="rounded p-0.5 text-gray-300 hover:text-red-500"
                              title="Remove row"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleImportFastPipeFixtures}
                    disabled={importingFixtures}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importingFixtures ? "Importing…" : `Import ${fixturePreviewRows.length} Fixture${fixturePreviewRows.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}

            {fixtureImportText.trim() && fixturePreviewRows.length === 0 && (
              <p className="text-xs text-amber-600">
                No valid rows found. Expected 4 tab-separated columns: Material Group, Qty, Size, Description.
              </p>
            )}
          </div>
        )}

        {/* Confirmed fixture display: grouped by cost code */}
        {fixtures.length > 0 && !showFixtureImport && (
          <div className="divide-y divide-gray-100">
            {fixtureCostCodes.map((code) => (
              <div key={code}>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
                    {code}
                  </span>
                  <span className="text-xs text-gray-500">
                    {fixturesByCode[code].length} item{fixturesByCode[code].length !== 1 ? "s" : ""}
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-14">Qty</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-16">Size</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Description</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {fixturesByCode[code].map((f) => (
                      <tr key={f.id} className="group">
                        <td className="px-4 py-2.5 text-sm tabular-nums text-gray-700">{f.quantity}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{f.size ?? "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-800">{f.description}</td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteFixture(f.id)}
                            className="rounded p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {fixtures.length === 0 && !showFixtureImport && (
          <div className="py-10 text-center text-sm text-gray-400">
            No fixtures yet. Click &ldquo;Paste FastPipe&rdquo; to import the fixture schedule.
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Action buttons */}
      {(status === "Draft" || status === "Opportunity") && (
        <div className="flex items-center gap-3 flex-wrap">
          {confirmOpportunity ? (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <span className="text-sm font-medium text-orange-800">
                {jobId
                  ? "Submit this bid? The linked job will move to Opportunity."
                  : "Mark this estimate as Opportunity (bid submitted)?"}
              </span>
              <button
                type="button"
                onClick={handleMarkOpportunity}
                disabled={saving}
                className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Yes, submit it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpportunity(false)}
                className="rounded border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : confirmAwarded ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <span className="text-sm font-medium text-green-800">
                {jobId
                  ? "Award this estimate? PM phases will be created from the imported budget."
                  : "Award this estimate? (No job linked — PM phases won't be created)"}
              </span>
              <button
                type="button"
                onClick={handleMarkAwarded}
                disabled={saving}
                className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Awarding…" : "Yes, award it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAwarded(false)}
                className="rounded border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : confirmLost ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <span className="text-sm font-medium text-red-800">Mark this estimate as Lost?</span>
              <button
                type="button"
                onClick={handleMarkLost}
                disabled={saving}
                className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Yes, lost"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmLost(false)}
                className="rounded border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {status === "Draft" && (
                <button
                  type="button"
                  onClick={() => setConfirmOpportunity(true)}
                  disabled={!resolvedId}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Bid
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmAwarded(true)}
                disabled={phases.length === 0 || !resolvedId}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Awarded
              </button>
              <button
                type="button"
                onClick={() => setConfirmLost(true)}
                disabled={!resolvedId}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Lost
              </button>
            </>
          )}
        </div>
      )}

      {/* Awarded / Lost status indicator */}
      {status !== "Draft" && status !== "Opportunity" && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          status === "Awarded"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          This estimate is marked as <strong>{status}</strong>.
          {status === "Awarded" && jobId && (
            <a href={`/jobs/${jobId}`} className="ml-2 underline hover:text-green-900">
              View job →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
