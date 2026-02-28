"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import SessionFormDrawer from "@/components/calendar/SessionFormDrawer";
import { db } from "@/lib/firebase";
import type { CostingPhase } from "@/types/costing";
import { employeeDisplayName, type Employee } from "@/types/employees";
import type { Job } from "@/types/jobs";
import {
  BUDGET_WARNING_COLORS,
  BUDGET_WARNING_LABELS,
  getBudgetWarning,
  SESSION_STATUS_COLORS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type ScheduleSession,
} from "@/types/scheduling";

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => monthStart(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [phases, setPhases] = useState<CostingPhase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [crewFilter, setCrewFilter] = useState<string>("all");

  // Dashboard collapse
  const [dashboardOpen, setDashboardOpen] = useState(true);

  // Session drawer
  const [sessionDrawer, setSessionDrawer] = useState<{
    open: boolean;
    session?: ScheduleSession;
    defaultDate?: string; // YYYY-MM-DD
  }>({ open: false });

  // ── Fetch Jobs ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "in", ["Awarded", "Active", "Install"]),
      orderBy("jobName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) })));
      setLoading(false);
    });
  }, []);

  // ── Fetch Employees ────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(db, "employees"),
      where("status", "==", "Employed"),
      orderBy("lastName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) })));
    });
  }, []);

  // ── Fetch Sessions for current month ───────────────────────────────────────

  useEffect(() => {
    const start = monthStart(currentMonth);
    const end = monthEnd(currentMonth);

    const q = query(
      collection(db, "scheduleSessions"),
      where("endDate", ">=", Timestamp.fromDate(start)),
      where("startDate", "<=", Timestamp.fromDate(end)),
      orderBy("startDate", "asc")
    );

    return onSnapshot(q, (snap) => {
      setSessions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleSession, "id">) }))
      );
    });
  }, [currentMonth]);

  // ── Fetch CostingPhases for budget warnings ────────────────────────────────

  useEffect(() => {
    if (jobs.length === 0) {
      setPhases([]);
      return;
    }
    const jobIds = jobs.map((j) => j.id);
    const chunks: string[][] = [];
    for (let i = 0; i < jobIds.length; i += 30) chunks.push(jobIds.slice(i, i + 30));

    const unsubs: (() => void)[] = [];
    const phasesByChunk = new Map<number, CostingPhase[]>();

    chunks.forEach((chunk, idx) => {
      const q = query(
        collection(db, "costingPhases"),
        where("jobId", "in", chunk)
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

  // ── Computed Data ──────────────────────────────────────────────────────────

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (jobFilter !== "all") {
      result = result.filter((s) => s.jobId === jobFilter);
    }
    if (crewFilter !== "all") {
      result = result.filter((s) => s.assignedCrewIds.includes(crewFilter));
    }
    return result;
  }, [sessions, jobFilter, crewFilter]);

  // Job color map: consistent by sorted jobIds
  const jobColorMap = useMemo(() => {
    const uniqueJobIds = [...new Set(sessions.map((s) => s.jobId))].sort();
    const map: Record<string, number> = {};
    uniqueJobIds.forEach((id, i) => {
      map[id] = i;
    });
    return map;
  }, [sessions]);

  // Today's sessions
  const todaySessions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return sessions.filter((s) => {
      if (s.status === "cancelled") return false;
      const start = s.startDate?.toDate?.();
      const end = s.endDate?.toDate?.();
      if (!start || !end) return false;
      // Session covers today if start <= today && end >= today
      return start <= todayEnd && end >= todayStart;
    });
  }, [sessions]);

  // Budget warnings
  const budgetWarnings = useMemo(() => {
    return phases
      .filter((p) => {
        const warning = getBudgetWarning(p);
        return warning !== "normal";
      })
      .map((p) => ({ phase: p, warning: getBudgetWarning(p) }));
  }, [phases]);

  // Stalled jobs: most recent session endDate > 21 days ago
  const stalledJobs = useMemo(() => {
    const now = new Date();
    const stalled: Array<{ job: Job; daysSince: number }> = [];

    for (const job of jobs) {
      if (job.projectPhase !== "Awarded" && job.projectPhase !== "Active") continue;
      const jobSessions = sessions.filter(
        (s) => s.jobId === job.id && s.status !== "cancelled"
      );
      if (jobSessions.length === 0) {
        // No sessions at all — potentially stalled, but skip if it's a brand new job
        continue;
      }
      const latestEnd = jobSessions.reduce((max, s) => {
        const end = s.endDate?.toDate?.();
        return end && end > max ? end : max;
      }, new Date(0));
      const days = daysBetween(latestEnd, now);
      if (days >= 21) {
        stalled.push({ job, daysSince: days });
      }
    }
    return stalled.sort((a, b) => b.daysSince - a.daysSince);
  }, [jobs, sessions]);

  // Selected crew member name (for title)
  const selectedCrewName = useMemo(() => {
    if (crewFilter === "all") return null;
    const emp = employees.find((e) => e.id === crewFilter);
    return emp ? employeeDisplayName(emp) : null;
  }, [crewFilter, employees]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function goToday() {
    setCurrentMonth(monthStart(new Date()));
  }

  function handleSessionClick(session: ScheduleSession) {
    setSessionDrawer({ open: true, session });
  }

  function handleDayClick(date: Date) {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSessionDrawer({ open: true, defaultDate: iso });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Calendar{selectedCrewName ? ` — ${selectedCrewName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Monthly schedule across all active projects.
            </p>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Previous month"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="min-w-[160px] text-center text-sm font-semibold text-gray-900">
                {fmtMonth(currentMonth)}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Next month"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Job filter */}
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {(j as unknown as Record<string, unknown>).jobNumber
                  ? `${(j as unknown as Record<string, unknown>).jobNumber} — `
                  : ""}
                {j.jobName}
              </option>
            ))}
          </select>

          {/* Crew filter */}
          <select
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Crew</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeDisplayName(e)}
              </option>
            ))}
          </select>

          {/* Dashboard toggle */}
          <button
            type="button"
            onClick={() => setDashboardOpen((v) => !v)}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              dashboardOpen
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Dashboard
          </button>
        </div>

        {/* Today / This Week Dashboard */}
        {dashboardOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Today's Sessions */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Today&apos;s Schedule
              </h3>
              {todaySessions.length === 0 ? (
                <p className="text-sm text-gray-400">No sessions today.</p>
              ) : (
                <div className="space-y-2">
                  {todaySessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSessionClick(s)}
                      className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{s.jobName}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SESSION_STATUS_COLORS[s.status]}`}>
                          {SESSION_STATUS_LABELS[s.status]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-gray-500">
                        {s.sessionType === "phase-work" ? s.phaseLabel : SESSION_TYPE_LABELS[s.sessionType]}
                        {" · "}
                        {s.assignedCrew.map((c) => c.employeeName.split(" ")[0]).join(", ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Warnings */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Budget Warnings
              </h3>
              {budgetWarnings.length === 0 ? (
                <p className="text-sm text-gray-400">All phases on track.</p>
              ) : (
                <div className="space-y-2">
                  {budgetWarnings.slice(0, 6).map(({ phase, warning }) => (
                    <div
                      key={phase.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{phase.jobName}</span>
                        <span className="ml-1.5 text-gray-400">{phase.label}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BUDGET_WARNING_COLORS[warning]}`}>
                        {BUDGET_WARNING_LABELS[warning]}
                      </span>
                    </div>
                  ))}
                  {budgetWarnings.length > 6 && (
                    <p className="text-[10px] text-gray-400">+{budgetWarnings.length - 6} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Stalled Jobs */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Stalled Jobs
              </h3>
              {stalledJobs.length === 0 ? (
                <p className="text-sm text-gray-400">No stalled jobs.</p>
              ) : (
                <div className="space-y-2">
                  {stalledJobs.map(({ job, daysSince }) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-gray-900">{job.jobName}</span>
                      <span className="whitespace-nowrap text-red-600 font-semibold">
                        {daysSince} days
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            </div>
          ) : (
            <MonthlyCalendar
              sessions={filteredSessions}
              currentMonth={currentMonth}
              onSessionClick={handleSessionClick}
              onDayClick={handleDayClick}
              jobColorMap={jobColorMap}
              highlightAvailability={crewFilter !== "all"}
            />
          )}
        </div>
      </div>

      {/* Session Drawer */}
      {sessionDrawer.open && (
        <SessionFormDrawer
          session={sessionDrawer.session}
          defaultDate={sessionDrawer.defaultDate}
          onClose={() => setSessionDrawer({ open: false })}
        />
      )}
    </AppShell>
  );
}
