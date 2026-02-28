"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import type { CostingPhase } from "@/types/costing";
import { ACCESS_LEVEL_LABELS, employeeDisplayName, type AccessLevel, type Employee } from "@/types/employees";
import type { Job } from "@/types/jobs";
import {
  checkCrewConflicts,
  SESSION_STATUS_COLORS,
  SESSION_TYPE_LABELS,
  type CrewConflict,
  type CrewRole,
  type GapReason,
  type ScheduleSession,
  type SessionStatus,
  type SessionType,
} from "@/types/scheduling";

// ── Helpers ──────────────────────────────────────────────────────────────────

function tsToIso(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return "";
  return ts.toDate().toISOString().slice(0, 10);
}

function isoToTs(val: string): Timestamp | null {
  if (!val) return null;
  return Timestamp.fromDate(new Date(val + "T00:00:00"));
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  session?: ScheduleSession | null;
  jobId?: string;
  jobName?: string;
  jobNumber?: string;
  costingPhaseId?: string;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSaved?: () => void;
}

// ── Crew Member Row ──────────────────────────────────────────────────────────

interface CrewEntry {
  employeeId: string;
  employeeName: string;
  role: CrewRole | null;
  hoursOverride: string;
}

// ── Session Types / Status ───────────────────────────────────────────────────

const SESSION_TYPES: SessionType[] = [
  "phase-work",
  "site-visit",
  "coordination",
  "warranty",
  "mobilization",
  "other",
];

const FORM_STATUSES: SessionStatus[] = ["tentative", "confirmed"];

const CREW_ROLES: { value: CrewRole; label: string }[] = [
  { value: "journeyman", label: "Journeyman" },
  { value: "apprentice", label: "Apprentice" },
  { value: "foreman", label: "Foreman" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SessionFormDrawer({
  session,
  jobId: initialJobId,
  jobName: initialJobName,
  jobNumber: initialJobNumber,
  costingPhaseId: initialPhaseId,
  defaultDate,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!session;

  // ── Form State ───────────────────────────────────────────────────────────

  const [sessionType, setSessionType] = useState<SessionType>(
    session?.sessionType ?? "phase-work"
  );
  const [startDate, setStartDate] = useState(
    session ? tsToIso(session.startDate) : defaultDate ?? ""
  );
  const [endDate, setEndDate] = useState(
    session ? tsToIso(session.endDate) : defaultDate ?? ""
  );
  const [hoursPerDay, setHoursPerDay] = useState(
    String(session?.hoursPerDay ?? 8)
  );
  const [includesWeekend, setIncludesWeekend] = useState(
    session?.includesWeekend ?? false
  );
  const [status, setStatus] = useState<SessionStatus>(
    session?.status ?? "tentative"
  );
  const [note, setNote] = useState(session?.note ?? "");

  // Job selection
  const [jobId, setJobId] = useState(session?.jobId ?? initialJobId ?? "");
  const [jobName, setJobName] = useState(
    session?.jobName ?? initialJobName ?? ""
  );
  const [jobNumber, setJobNumber] = useState(
    session?.jobNumber ?? initialJobNumber ?? ""
  );
  const [jobSearch, setJobSearch] = useState("");
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const jobLocked = !!(initialJobId && !isEdit);

  // Phase selection
  const [costingPhaseId, setCostingPhaseId] = useState(
    session?.costingPhaseId ?? initialPhaseId ?? ""
  );
  const [costCode, setCostCode] = useState(session?.costCode ?? "");
  const [phaseLabel, setPhaseLabel] = useState(session?.phaseLabel ?? "");
  const [jobPhases, setJobPhases] = useState<CostingPhase[]>([]);

  // Crew
  const [crew, setCrew] = useState<CrewEntry[]>(() => {
    if (session?.assignedCrew) {
      return session.assignedCrew.map((c) => ({
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        role: c.role ?? null,
        hoursOverride: c.hoursPerDay != null ? String(c.hoursPerDay) : "",
      }));
    }
    return [];
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [prevailingWage, setPrevailingWage] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<CrewConflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────

  // Fetch active employees
  useEffect(() => {
    const q = query(
      collection(db, "employees"),
      where("status", "==", "Employed"),
      orderBy("firstName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setEmployees(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))
      );
    });
  }, []);

  // Fetch jobs for search (only when not locked)
  useEffect(() => {
    if (jobLocked) return;
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "in", ["Awarded", "Active", "Install"]),
      orderBy("jobName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setAllJobs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
      );
    });
  }, [jobLocked]);

  // Fetch costing phases when jobId changes
  useEffect(() => {
    if (!jobId) {
      setJobPhases([]);
      return;
    }
    const q = query(
      collection(db, "costingPhases"),
      where("jobId", "==", jobId),
      orderBy("importedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setJobPhases(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostingPhase, "id">) }))
      );
    });
  }, [jobId]);

  // Check prevailing wage on job
  useEffect(() => {
    if (!jobId) {
      setPrevailingWage(false);
      return;
    }
    getDoc(doc(db, "Jobs", jobId)).then((snap) => {
      if (snap.exists()) {
        setPrevailingWage(!!(snap.data() as Record<string, unknown>).prevailingWage);
      }
    });
  }, [jobId]);

  // Job search suggestions
  const jobSuggestions = useMemo(() => {
    if (jobLocked || jobSearch.length < 2) return [];
    const q = jobSearch.toLowerCase();
    return allJobs.filter((j) => j.jobName.toLowerCase().includes(q)).slice(0, 8);
  }, [jobSearch, allJobs, jobLocked]);

  // Available employees (not already added)
  const availableEmployees = useMemo(() => {
    const assigned = new Set(crew.map((c) => c.employeeId));
    return employees.filter((e) => !assigned.has(e.id));
  }, [employees, crew]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function selectJob(j: Job) {
    setJobId(j.id);
    setJobName(j.jobName);
    setJobNumber((j as unknown as Record<string, unknown>).jobNumber as string ?? "");
    setJobSearch("");
    setCostingPhaseId("");
    setCostCode("");
    setPhaseLabel("");
  }

  function selectPhase(phaseId: string) {
    const phase = jobPhases.find((p) => p.id === phaseId);
    if (phase) {
      setCostingPhaseId(phase.id);
      setCostCode(phase.costCode);
      setPhaseLabel(phase.label);
    }
  }

  function addCrewMember(empId: string) {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setCrew((prev) => [
      ...prev,
      {
        employeeId: emp.id,
        employeeName: employeeDisplayName(emp),
        role: null,
        hoursOverride: "",
      },
    ]);
  }

  function removeCrewMember(empId: string) {
    setCrew((prev) => prev.filter((c) => c.employeeId !== empId));
  }

  function updateCrewRole(empId: string, role: CrewRole | null) {
    setCrew((prev) =>
      prev.map((c) => (c.employeeId === empId ? { ...c, role } : c))
    );
  }

  function updateCrewHours(empId: string, hours: string) {
    setCrew((prev) =>
      prev.map((c) => (c.employeeId === empId ? { ...c, hoursOverride: hours } : c))
    );
  }

  async function handleSave() {
    setError(null);
    setConflicts([]);

    // Validation
    if (!jobId) { setError("Select a job."); return; }
    if (sessionType === "phase-work" && !costingPhaseId) {
      setError("Select a phase for phase work sessions.");
      return;
    }
    if (!startDate) { setError("Start date is required."); return; }
    if (!endDate) { setError("End date is required."); return; }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date must be before or equal to end date.");
      return;
    }
    if (crew.length === 0) { setError("Assign at least one crew member."); return; }

    setSaving(true);

    try {
      const auth = getFirebaseAuth();
      const user = auth?.currentUser;

      const assignedCrew = crew.map((c) => ({
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        role: c.role ?? null,
        ...(c.hoursOverride ? { hoursPerDay: Number(c.hoursOverride) } : {}),
      }));
      const assignedCrewIds = crew.map((c) => c.employeeId);

      const sessionData: Record<string, unknown> = {
        jobId,
        jobNumber,
        jobName,
        costingPhaseId: sessionType === "phase-work" ? costingPhaseId : "",
        costCode: sessionType === "phase-work" ? costCode : "",
        phaseLabel: sessionType === "phase-work" ? phaseLabel : "",
        sessionType,
        startDate: isoToTs(startDate),
        endDate: isoToTs(endDate),
        hoursPerDay: Number(hoursPerDay) || 8,
        includesWeekend,
        status,
        assignedCrew,
        assignedCrewIds,
        note: note.trim() || null,
        updatedAt: serverTimestamp(),
      };

      // Check conflicts (warn, don't block)
      const partialSession = {
        assignedCrew,
        startDate: isoToTs(startDate)!,
        endDate: isoToTs(endDate)!,
      } as Partial<ScheduleSession>;

      const found = await checkCrewConflicts(
        partialSession,
        isEdit ? session!.id : undefined
      );
      if (found.length > 0) {
        setConflicts(found);
      }

      if (isEdit) {
        await updateDoc(doc(db, "scheduleSessions", session!.id), sessionData);
      } else {
        sessionData.createdAt = serverTimestamp();
        sessionData.createdBy = user?.email ?? "unknown";
        await addDoc(collection(db, "scheduleSessions"), sessionData);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save session:", err);
      setError("Failed to save session. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[540px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Edit Session" : "New Session"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <p className="font-semibold mb-1">Scheduling Conflicts</p>
              {conflicts.map((c, i) => (
                <p key={i}>
                  {c.employeeName} is also scheduled at{" "}
                  <span className="font-medium">{c.conflictingSession.jobName}</span>
                  {c.conflictingSession.phaseLabel ? ` (${c.conflictingSession.phaseLabel})` : ""}
                </p>
              ))}
            </div>
          )}

          {/* Job */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Job
            </label>
            {jobLocked || isEdit ? (
              <p className="text-sm font-medium text-gray-900">{jobName}</p>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={jobId ? jobName : jobSearch}
                  onChange={(e) => {
                    setJobSearch(e.target.value);
                    if (jobId) {
                      setJobId("");
                      setJobName("");
                      setJobNumber("");
                      setCostingPhaseId("");
                    }
                  }}
                  placeholder="Search jobs…"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {jobSuggestions.length > 0 && !jobId && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {jobSuggestions.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => selectJob(j)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50"
                      >
                        {j.jobName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Session Type
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SESSION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Phase (only for phase-work) */}
          {sessionType === "phase-work" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Phase
              </label>
              {jobPhases.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {jobId ? "No phases found for this job." : "Select a job first."}
                </p>
              ) : (
                <select
                  value={costingPhaseId}
                  onChange={(e) => selectPhase(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select phase…</option>
                  {jobPhases
                    .filter((p) => p.subgrouping === "CONTRACTED WORK" || p.subgrouping === "CHANGE ORDER")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.costCode} — {p.label}
                        {p.subgrouping === "CHANGE ORDER" ? ` (${p.costCode})` : ""}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {/* Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Hours per day + Weekend toggle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Hours Per Day
              </label>
              <input
                type="number"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
                min={1}
                max={16}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesWeekend}
                  onChange={(e) => setIncludesWeekend(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Includes Weekend
              </label>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Status
            </label>
            <div className="flex gap-2">
              {FORM_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    status === s
                      ? SESSION_STATUS_COLORS[s]
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s === "tentative" ? "Tentative" : "Confirmed"}
                </button>
              ))}
            </div>
          </div>

          {/* Crew Assignment */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Assigned Crew
            </label>

            {/* Crew list */}
            {crew.length > 0 && (
              <div className="space-y-2 mb-3">
                {crew.map((c) => (
                  <div
                    key={c.employeeId}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-900 flex-1">
                      {c.employeeName}
                    </span>
                    {prevailingWage && (
                      <select
                        value={c.role ?? ""}
                        onChange={(e) =>
                          updateCrewRole(
                            c.employeeId,
                            e.target.value ? (e.target.value as CrewRole) : null
                          )
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                      >
                        <option value="">No role</option>
                        {CREW_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      value={c.hoursOverride}
                      onChange={(e) => updateCrewHours(c.employeeId, e.target.value)}
                      placeholder={hoursPerDay}
                      min={0}
                      max={16}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 text-center placeholder:text-gray-400"
                      title="Hours per day override"
                    />
                    <button
                      type="button"
                      onClick={() => removeCrewMember(c.employeeId)}
                      className="text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add crew dropdown */}
            {availableEmployees.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addCrewMember(e.target.value);
                }}
                className="block w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">+ Add crew member…</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {employeeDisplayName(e)}{e.accessLevel ? ` (${ACCESS_LEVEL_LABELS[e.accessLevel as AccessLevel] ?? e.accessLevel})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Note
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional session notes…"
              className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
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
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Update Session" : "Create Session"}
          </button>
        </div>
      </div>
    </>
  );
}
