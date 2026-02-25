"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CostCode } from "@/types/costCodes";
import {
  calcEstimateRollup,
  type EstimateLine,
  type ServiceEstimate,
} from "@/types/estimates";
import { contactDisplayName, type Company, type Contact } from "@/types/companies";
import type { Job } from "@/types/jobs";

interface Props {
  estimateId?: string;
}

interface LocalLine {
  id?: string;
  costCode: string;
  description: string;
  laborHours: number;
  materialCost: number;
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

export default function EstimateBuilder({ estimateId }: Props) {
  const router = useRouter();

  // Resolved estimate ID — starts as prop, set when new doc is created
  const resolvedIdRef = useRef<string | undefined>(estimateId);
  const [resolvedId, setResolvedId] = useState<string | undefined>(estimateId);

  // Header fields
  const [jobName, setJobName] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [status, setStatus] = useState<ServiceEstimate["status"]>("Draft");
  const [laborRate, setLaborRate] = useState(350);
  const [laborBurden, setLaborBurden] = useState(120);
  const [materialMarkup, setMaterialMarkup] = useState(40);

  // Line items
  const [lines, setLines] = useState<LocalLine[]>([]);

  // Cost codes for dropdown
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Job typeahead
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);

  // Contractor (GC company) typeahead
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [gcId, setGcId] = useState<string | undefined>();
  const [gcName, setGcName] = useState("");
  const [gcSearch, setGcSearch] = useState("");
  const [showGcSuggestions, setShowGcSuggestions] = useState(false);

  // Estimator (people/contacts) typeahead
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [estimatorId, setEstimatorId] = useState<string | undefined>();
  const [estimatorName, setEstimatorName] = useState("");
  const [estimatorSearch, setEstimatorSearch] = useState("");
  const [showEstimatorSuggestions, setShowEstimatorSuggestions] = useState(false);

  // UI
  const [loading, setLoading] = useState(!!estimateId);
  const [saving, setSaving] = useState(false);
  const [confirmOpportunity, setConfirmOpportunity] = useState(false);
  const [confirmAwarded, setConfirmAwarded] = useState(false);
  const [confirmLost, setConfirmLost] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [copiedQBO, setCopiedQBO] = useState(false);

  // Load cost codes
  useEffect(() => {
    getDocs(query(collection(db, "costCodes"), orderBy("sortOrder", "asc")))
      .then((snap) =>
        setCostCodes(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostCode, "id">) }))
        )
      )
      .catch(console.error);
  }, []);

  // Load all jobs for typeahead (small collection)
  useEffect(() => {
    getDocs(query(collection(db, "Jobs"), orderBy("jobName", "asc")))
      .then((snap) =>
        setAllJobs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
        )
      )
      .catch(console.error);
  }, []);

  // Load companies for contractor typeahead
  useEffect(() => {
    getDocs(query(collection(db, "companies"), orderBy("name", "asc")))
      .then((snap) =>
        setAllCompanies(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, "id">) }))
        )
      )
      .catch(console.error);
  }, []);

  // Load people (contacts) for estimator typeahead
  useEffect(() => {
    getDocs(query(collection(db, "contacts"), orderBy("lastName", "asc")))
      .then((snap) =>
        setAllContacts(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }))
        )
      )
      .catch(console.error);
  }, []);

  // Load existing estimate + lines
  useEffect(() => {
    if (!estimateId) return;
    async function load() {
      setLoading(true);
      try {
        const [estSnap, linesSnap] = await Promise.all([
          getDoc(doc(db, "estimates", estimateId!)),
          getDocs(
            query(
              collection(db, "estimateLines"),
              where("estimateId", "==", estimateId),
              orderBy("sortOrder", "asc")
            )
          ),
        ]);
        if (estSnap.exists()) {
          const e = estSnap.data() as Omit<ServiceEstimate, "id">;
          setJobName(e.jobName ?? "");
          setJobSearch(e.jobName ?? "");
          setJobId(e.jobId);
          setGcId(e.gcId);
          setGcName(e.gcName ?? "");
          setGcSearch(e.gcName ?? "");
          setEstimatorId(e.estimatorId);
          setEstimatorName(e.estimatorName ?? "");
          setEstimatorSearch(e.estimatorName ?? "");
          setStatus(e.status);
          setLaborRate(e.laborRate ?? 350);
          setLaborBurden(e.laborBurden ?? 120);
          setMaterialMarkup(e.materialMarkup ?? 40);
        }
        setLines(
          linesSnap.docs.map((d) => {
            const l = d.data() as Omit<EstimateLine, "id">;
            return {
              id: d.id,
              costCode: l.costCode,
              description: l.description,
              laborHours: l.laborHours,
              materialCost: l.materialCost,
              sortOrder: l.sortOrder,
            };
          })
        );
      } catch (err) {
        console.error("Failed to load estimate:", err);
        setError("Failed to load estimate.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [estimateId]);

  // Live rollup from current lines + rates
  const rollup = useMemo(
    () =>
      calcEstimateRollup(
        lines.map((l) => ({ laborHours: l.laborHours, materialCost: l.materialCost })),
        laborRate,
        laborBurden,
        materialMarkup
      ),
    [lines, laborRate, laborBurden, materialMarkup]
  );

  // Job search filter
  const jobSuggestions = useMemo(() => {
    if (jobSearch.length < 2) return [];
    const q = jobSearch.toLowerCase();
    return allJobs.filter((j) => j.jobName.toLowerCase().includes(q)).slice(0, 8);
  }, [jobSearch, allJobs]);

  // GC company search filter
  const gcSuggestions = useMemo(() => {
    if (gcSearch.length < 2) return [];
    const q = gcSearch.toLowerCase();
    return allCompanies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [gcSearch, allCompanies]);

  // Estimator search filter (people/contacts) — show from first character, match name/title/company
  const estimatorSuggestions = useMemo(() => {
    const q = estimatorSearch.trim().toLowerCase();
    if (!q) return allContacts.slice(0, 12);
    return allContacts
      .filter((c) => {
        const name = contactDisplayName(c).toLowerCase();
        const title = (c.title ?? "").toLowerCase();
        const company = (c.companyName ?? "").toLowerCase();
        return name.includes(q) || title.includes(q) || company.includes(q);
      })
      .slice(0, 12);
  }, [estimatorSearch, allContacts]);

  // Create estimate doc on first meaningful action, returns id
  async function ensureEstimateDoc(): Promise<string> {
    if (resolvedIdRef.current) return resolvedIdRef.current;
    const ref = await addDoc(collection(db, "estimates"), {
      jobName: jobName || "Untitled Estimate",
      jobId: jobId ?? null,
      gcId: gcId ?? null,
      gcName: gcName || null,
      estimatorId: estimatorId ?? null,
      estimatorName: estimatorName || null,
      status: "Draft",
      laborRate,
      laborBurden,
      materialMarkup,
      notes: "",
      totalHours: 0,
      totalLaborBilling: 0,
      totalMaterialCost: 0,
      totalContractValue: 0,
      profitMargin: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    resolvedIdRef.current = ref.id;
    setResolvedId(ref.id);
    window.history.replaceState(null, "", `/estimates/${ref.id}`);
    return ref.id;
  }

  // Write rollup totals + header fields to estimate doc
  async function saveRollup(eid: string, currentLines: LocalLine[]) {
    const r = calcEstimateRollup(
      currentLines.map((l) => ({ laborHours: l.laborHours, materialCost: l.materialCost })),
      laborRate,
      laborBurden,
      materialMarkup
    );
    await updateDoc(doc(db, "estimates", eid), {
      ...r,
      laborRate,
      laborBurden,
      materialMarkup,
      jobName: jobName || "Untitled Estimate",
      jobId: jobId ?? null,
      gcId: gcId ?? null,
      gcName: gcName || null,
      estimatorId: estimatorId ?? null,
      estimatorName: estimatorName || null,
      updatedAt: serverTimestamp(),
    });
  }

  // Save header fields (called on blur of rate inputs / job field)
  async function saveHeader() {
    const eid = resolvedIdRef.current;
    if (!eid) return;
    try {
      await saveRollup(eid, lines);
    } catch (err) {
      console.error("Failed to save header:", err);
    }
  }

  // Add a new line
  async function handleAddLine() {
    try {
      const eid = await ensureEstimateDoc();
      const nextOrder =
        lines.length > 0 ? Math.max(...lines.map((l) => l.sortOrder)) + 1 : 1;
      const defaultCode = costCodes[0]?.code ?? "GW";

      const ref = await addDoc(collection(db, "estimateLines"), {
        estimateId: eid,
        costCode: defaultCode,
        description: "",
        laborHours: 0,
        materialCost: 0,
        sortOrder: nextOrder,
        createdAt: serverTimestamp(),
      });

      setLines((prev) => [
        ...prev,
        {
          id: ref.id,
          costCode: defaultCode,
          description: "",
          laborHours: 0,
          materialCost: 0,
          sortOrder: nextOrder,
        },
      ]);
    } catch (err) {
      console.error("Failed to add line:", err);
    }
  }

  // Update a line field in local state
  function updateLine(
    index: number,
    field: keyof LocalLine,
    value: string | number
  ) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  // Save a line on blur
  async function saveLineToFirestore(index: number) {
    const line = lines[index];
    if (!line.id) return;
    try {
      await updateDoc(doc(db, "estimateLines", line.id), {
        costCode: line.costCode,
        description: line.description,
        laborHours: line.laborHours,
        materialCost: line.materialCost,
      });
      const eid = resolvedIdRef.current;
      if (eid) {
        await saveRollup(eid, lines);
      }
    } catch (err) {
      console.error("Failed to save line:", err);
    }
  }

  // Delete a line
  async function handleDeleteLine(index: number) {
    const line = lines[index];
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
    if (line.id) {
      try {
        await deleteDoc(doc(db, "estimateLines", line.id));
        const eid = resolvedIdRef.current;
        if (eid) await saveRollup(eid, newLines);
      } catch (err) {
        console.error("Failed to delete line:", err);
      }
    }
  }

  // Delete entire estimate and redirect
  async function handleDeleteEstimate() {
    const eid = resolvedIdRef.current;
    if (!eid) return;
    setDeleting(true);
    setError("");
    try {
      const linesSnap = await getDocs(
        query(
          collection(db, "estimateLines"),
          where("estimateId", "==", eid)
        )
      );
      await Promise.all(linesSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "estimates", eid));
      setConfirmDelete(false);
      router.push("/estimates");
    } catch (err) {
      console.error("Failed to delete estimate:", err);
      setError("Failed to delete estimate. Please try again.");
      setDeleting(false);
    }
  }

  // Mark Awarded — create job if none linked, then group lines into costingPhases so job is tracked in PM
  async function handleMarkAwarded() {
    if (!resolvedId) return;
    setSaving(true);
    setError("");
    try {
      const codeMap = new Map(costCodes.map((c) => [c.code, c.label]));

      // If no job linked, create one so this award is tracked in project management
      let effectiveJobId = jobId;
      let effectiveJobName = jobName || "Untitled Estimate";
      if (!effectiveJobId) {
        const jobPayload = {
          jobName: effectiveJobName,
          projectPhase: "Install" as const,
          gcId: gcId ?? null,
          gcName: gcName || null,
          estimatorId: estimatorId ?? null,
          estimatorName: estimatorName || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const clean = Object.fromEntries(
          Object.entries(jobPayload).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        const jobRef = await addDoc(collection(db, "Jobs"), clean);
        effectiveJobId = jobRef.id;
        setJobId(effectiveJobId);
        setAllJobs((prev) => [...prev, { id: effectiveJobId!, jobName: effectiveJobName, projectPhase: "Install" } as Job].sort((a, b) => a.jobName.localeCompare(b.jobName)));
      } else {
        effectiveJobName = jobName || effectiveJobName;
      }

      // Group lines by costCode and create costing phases (so job appears in PM with budget)
      const grouped: Record<string, { hours: number; mat: number; label: string }> =
        {};
      for (const line of lines) {
        if (!grouped[line.costCode]) {
          grouped[line.costCode] = {
            hours: 0,
            mat: 0,
            label: codeMap.get(line.costCode) ?? line.costCode,
          };
        }
        grouped[line.costCode].hours += line.laborHours;
        grouped[line.costCode].mat += line.materialCost;
      }

      await Promise.all(
        Object.entries(grouped).map(([costCode, vals]) => {
          const estLaborCost = vals.hours * laborRate;
          const contractValue =
            estLaborCost + vals.mat * (1 + materialMarkup / 100);
          return addDoc(collection(db, "costingPhases"), {
            jobId: effectiveJobId,
            jobName: effectiveJobName,
            costCode,
            label: vals.label,
            subgrouping: "CONTRACTED WORK",
            estMaterialCost: vals.mat,
            estLaborCost,
            estHours: vals.hours,
            mMarkup: materialMarkup,
            lMarkup: 0,
            contractValue,
            importedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        })
      );

      if (jobId) {
        await updateDoc(doc(db, "Jobs", effectiveJobId!), {
          projectPhase: "Install",
          updatedAt: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "estimates", resolvedId), {
        status: "Awarded",
        jobId: effectiveJobId ?? null,
        jobName: effectiveJobName,
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

  // Mark as Opportunity (bid submitted to client)
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

  // Copy QBO export table to clipboard
  function handleCopyQBO() {
    const header = ["Cost Code", "Description", "Labor", "Materials", "Total"].join("\t");
    const rows = lines.map((line) => {
      const labor = fmt(line.laborHours * laborRate);
      const mat = fmt(line.materialCost * (1 + materialMarkup / 100));
      const total = fmt(line.laborHours * laborRate + line.materialCost * (1 + materialMarkup / 100));
      return [line.costCode, line.description || "(no description)", labor, mat, total].join("\t");
    });
    navigator.clipboard.writeText([header, ...rows].join("\n")).then(() => {
      setCopiedQBO(true);
      setTimeout(() => setCopiedQBO(false), 2000);
    });
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
          <a href="/estimates" className="hover:text-blue-600">
            Estimates
          </a>
          <span>/</span>
          <span className="text-gray-900 font-medium">
            {jobName || "New Estimate"}
          </span>
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        {/* Row 1: Job + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div className="relative max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Job Name
            </label>
            <input
              type="text"
              value={jobSearch}
              onChange={(e) => {
                setJobSearch(e.target.value);
                setJobName(e.target.value);
                setJobId(undefined);
                setShowJobSuggestions(true);
              }}
              onFocus={() => setShowJobSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowJobSuggestions(false), 150);
                saveHeader();
              }}
              placeholder="Type to search existing jobs or enter free text…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showJobSuggestions && (jobSuggestions.length > 0 || jobSearch.trim().length >= 2) && (
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
                      setGcId(j.gcId ?? undefined);
                      setGcName(j.gcName ?? "");
                      setGcSearch(j.gcName ?? "");
                      setEstimatorId(j.estimatorId ?? undefined);
                      setEstimatorName(j.estimatorName ?? "");
                      setEstimatorSearch(j.estimatorName ?? "");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-4"
                  >
                    <span className="font-medium text-gray-900">{j.jobName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{j.projectPhase}</span>
                  </button>
                ))}
                {jobSearch.trim().length >= 2 && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      setShowJobSuggestions(false);
                      try {
                        const ref = await addDoc(collection(db, "Jobs"), {
                          jobName: jobSearch.trim(),
                          projectPhase: "Install",
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });
                        const created = { id: ref.id, jobName: jobSearch.trim(), projectPhase: "Install" as const };
                        setAllJobs((prev) => [...prev, created as Job].sort((a, b) => a.jobName.localeCompare(b.jobName)));
                        setJobId(ref.id);
                        setJobName(created.jobName);
                        setJobSearch(created.jobName);
                      } catch (err) {
                        console.error("Create job failed:", err);
                        setError("Failed to create job. Try again.");
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-sm border-t border-gray-100 bg-gray-50 hover:bg-blue-50 flex items-center gap-2 text-blue-600 font-medium"
                  >
                    <span>+ Create new job &ldquo;{jobSearch.trim()}&rdquo;</span>
                  </button>
                )}
              </div>
            )}
            {jobId && (
              <p className="mt-1 text-xs text-blue-600">
                Linked to job —{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setJobId(undefined);
                    setJobSearch(jobName);
                  }}
                >
                  unlink
                </button>
              </p>
            )}
          </div>

          {/* Status badge */}
          <div className="sm:text-right">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Status
            </label>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                status === "Draft"       ? "bg-gray-100 text-gray-700"
                : status === "Opportunity" ? "bg-orange-100 text-orange-700"
                : status === "Awarded"     ? "bg-green-100 text-green-700"
                :                           "bg-red-100 text-red-600"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Row 2: Contractor + Estimator — equal width, capped */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Contractor
            </label>
            <input
              type="text"
              value={gcSearch}
              onChange={(e) => {
                setGcSearch(e.target.value);
                setGcName(e.target.value);
                setGcId(undefined);
                setShowGcSuggestions(true);
              }}
              onFocus={() => setShowGcSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowGcSuggestions(false), 150);
                saveHeader();
              }}
              placeholder="Search companies…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showGcSuggestions && gcSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                {gcSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setGcName(c.name);
                      setGcSearch(c.name);
                      setGcId(c.id);
                      setShowGcSuggestions(false);
                      saveHeader();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-4"
                  >
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{c.type}</span>
                  </button>
                ))}
              </div>
            )}
            {gcId && (
              <p className="mt-1 text-xs text-blue-600">
                <a href={`/companies/${gcId}`} className="underline hover:text-blue-800">
                  View company
                </a>
                {" — "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => { setGcId(undefined); setGcName(""); setGcSearch(""); saveHeader(); }}
                >
                  unlink
                </button>
              </p>
            )}
          </div>

          {/* Estimator typeahead */}
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Estimator
            </label>
            <input
              type="text"
              value={estimatorSearch}
              onChange={(e) => {
                setEstimatorSearch(e.target.value);
                setEstimatorName(e.target.value);
                setEstimatorId(undefined);
                setShowEstimatorSuggestions(true);
              }}
              onFocus={() => setShowEstimatorSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowEstimatorSuggestions(false), 180);
                saveHeader();
              }}
              placeholder="Type to search name, title, or company…"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showEstimatorSuggestions && estimatorSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                {estimatorSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      const name = contactDisplayName(c);
                      setEstimatorName(name);
                      setEstimatorSearch(name);
                      setEstimatorId(c.id);
                      setShowEstimatorSuggestions(false);
                      saveHeader();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-4"
                  >
                    <span className="font-medium text-gray-900">{contactDisplayName(c)}</span>
                    <span className="text-xs text-gray-400 shrink-0">{[c.title, c.companyName].filter(Boolean).join(" · ") || "Contact"}</span>
                  </button>
                ))}
              </div>
            )}
            {estimatorId && (
              <p className="mt-1 text-xs text-gray-600">
                <a href={`/contacts/${estimatorId}/edit`} className="text-blue-600 underline hover:text-blue-800">
                  Edit
                </a>
                {" · "}
                <a href="/contacts" className="text-blue-600 underline hover:text-blue-800">
                  People
                </a>
                {" · "}
                <button
                  type="button"
                  className="text-blue-600 underline hover:text-blue-800"
                  onClick={() => { setEstimatorId(undefined); setEstimatorName(""); setEstimatorSearch(""); saveHeader(); }}
                >
                  unlink
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Site address (from linked job) */}
        {jobId && (() => {
          const linkedJob = allJobs.find((j) => j.id === jobId);
          const parts = [linkedJob?.siteAddress, linkedJob?.siteCity, linkedJob?.siteState, linkedJob?.siteZip].filter(Boolean);
          if (parts.length === 0) return null;
          return (
            <div className="pt-1 border-t border-gray-100">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Site address
              </label>
              <p className="text-sm text-gray-700">
                {parts.join(", ")}
                {" · "}
                <a href={`/jobs/${jobId}`} className="text-blue-600 hover:underline">
                  Edit job
                </a>
              </p>
            </div>
          );
        })()}

        {/* Row 3: Rate inputs — aligned in a row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-1 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Labor rate (billing)
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="number"
                min={0}
                value={laborRate}
                onChange={(e) => setLaborRate(Number(e.target.value))}
                onBlur={saveHeader}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">/hr</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Labor burden (cost)
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="number"
                min={0}
                value={laborBurden}
                onChange={(e) => setLaborBurden(Number(e.target.value))}
                onBlur={saveHeader}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">/hr</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Material markup
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={materialMarkup}
                onChange={(e) => setMaterialMarkup(Number(e.target.value))}
                onBlur={saveHeader}
                className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
          <button
            type="button"
            onClick={handleAddLine}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Line
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No line items yet. Click &ldquo;Add Line&rdquo; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-36">
                    Code
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Description
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-20">
                    Hours
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">
                    Mat Cost
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">
                    Labor $
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">
                    Mat $
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">
                    Total
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {lines.map((line, i) => {
                  const laborTotal = line.laborHours * laborRate;
                  const matTotal = line.materialCost * (1 + materialMarkup / 100);
                  const lineTotal = laborTotal + matTotal;
                  return (
                    <tr key={line.id ?? i} className="group">
                      {/* Cost code dropdown */}
                      <td className="px-3 py-2">
                        <select
                          value={line.costCode}
                          onChange={(e) => updateLine(i, "costCode", e.target.value)}
                          onBlur={() => saveLineToFirestore(i)}
                          className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs font-mono font-semibold text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {costCodes.map((c) => (
                            <option key={c.id} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                          {/* Show current code even if not in costCodes list */}
                          {!costCodes.some((c) => c.code === line.costCode) && (
                            <option value={line.costCode}>{line.costCode}</option>
                          )}
                        </select>
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) =>
                            updateLine(i, "description", e.target.value)
                          }
                          onBlur={() => saveLineToFirestore(i)}
                          placeholder="Description…"
                          className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
                        />
                      </td>

                      {/* Labor hours */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={line.laborHours}
                          onChange={(e) =>
                            updateLine(i, "laborHours", Number(e.target.value))
                          }
                          onBlur={() => saveLineToFirestore(i)}
                          className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm text-right tabular-nums text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>

                      {/* Material cost (raw) */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.materialCost}
                          onChange={(e) =>
                            updateLine(i, "materialCost", Number(e.target.value))
                          }
                          onBlur={() => saveLineToFirestore(i)}
                          className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm text-right tabular-nums text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>

                      {/* Labor $ (calculated) */}
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-500">
                        {fmt(laborTotal)}
                      </td>

                      {/* Mat $ with markup (calculated) */}
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-500">
                        {fmt(matTotal)}
                      </td>

                      {/* Line total */}
                      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-gray-900">
                        {fmt(lineTotal)}
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(i)}
                          className="rounded p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove line"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals bar */}
      {lines.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-4">
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Hours
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900">
                {rollup.totalHours % 1 === 0
                  ? rollup.totalHours
                  : rollup.totalHours.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Labor
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900">
                {fmt(rollup.totalLaborBilling)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Materials (w/ markup)
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900">
                {fmt(rollup.totalMaterialCost * (1 + materialMarkup / 100))}
              </p>
            </div>
            <div className="border-l border-gray-200 pl-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Contract Value
              </p>
              <p className="text-3xl font-bold tabular-nums text-gray-900">
                {fmt(rollup.totalContractValue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Margin
              </p>
              <p
                className={`text-xl font-bold tabular-nums ${
                  rollup.totalContractValue === 0
                    ? "text-gray-400"
                    : rollup.profitMargin >= 30
                    ? "text-green-700"
                    : rollup.profitMargin >= 15
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {rollup.totalContractValue > 0
                  ? `${rollup.profitMargin.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QBO Export */}
      {lines.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">QBO Export</h2>
              <p className="text-xs text-gray-400 mt-0.5">Copy and paste into QuickBooks Online estimate or invoice.</p>
            </div>
            <button
              type="button"
              onClick={handleCopyQBO}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                copiedQBO
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copiedQBO ? (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                  </svg>
                  Copy for QBO
                </>
              )}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-20">Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">Labor</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">Materials</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {lines.map((line, i) => {
                  const labor = line.laborHours * laborRate;
                  const mat = line.materialCost * (1 + materialMarkup / 100);
                  return (
                    <tr key={line.id ?? i}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-700">{line.costCode}</td>
                      <td className="px-4 py-2.5 text-gray-700">{line.description || <span className="italic text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(labor)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(mat)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(labor + mat)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-gray-600">Total</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(rollup.totalLaborBilling)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(rollup.totalMaterialCost * (1 + materialMarkup / 100))}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(rollup.totalContractValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Action buttons — Draft and Opportunity states */}
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
                  ? "Award this estimate and create PM phases?"
                  : "Award this estimate? A new job will be created and tracked in Project Management."}
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
              <span className="text-sm font-medium text-red-800">
                Mark this estimate as Lost?
              </span>
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
                disabled={lines.length === 0 || !resolvedId}
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

      {/* Awarded / Lost / Opportunity status indicator */}
      {status !== "Draft" && status !== "Opportunity" && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            status === "Awarded"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          This estimate is marked as <strong>{status}</strong>.
          {status === "Awarded" && jobId && (
            <a
              href={`/jobs/${jobId}`}
              className="ml-2 underline hover:text-green-900"
            >
              View job →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
