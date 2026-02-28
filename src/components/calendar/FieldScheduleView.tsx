"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import CapacityBadge from "@/components/calendar/CapacityBadge";
import { db } from "@/lib/firebase";
import type { CostingPhase } from "@/types/costing";
import type { Job } from "@/types/jobs";
import {
  getRemainingHours,
  getSessionCapacity,
  SESSION_STATUS_COLORS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type ScheduleSession,
} from "@/types/scheduling";

interface Props {
  employeeId: string;
  onCompleteSession?: (session: ScheduleSession) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextBusinessDays(count: number): Date[] {
  const days: Date[] = [];
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  // Start from tomorrow
  current.setDate(current.getDate() + 1);
  while (days.length < count) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function sessionCoversDate(session: ScheduleSession, date: Date): boolean {
  const start = session.startDate?.toDate?.();
  const end = session.endDate?.toDate?.();
  if (!start || !end) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (d < s || d > e) return false;
  const dow = d.getDay();
  if ((dow === 0 || dow === 6) && !session.includesWeekend) return false;
  return true;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function dateLabel(d: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return `Today — ${fmtDate(d)}`;
  if (diff === 1) return `Tomorrow — ${fmtDate(d)}`;
  return fmtDate(d);
}

function buildMapsUrl(job: Job): string | null {
  const parts = [job.siteAddress, job.siteCity, job.siteState, job.siteZip].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

function buildAddressLine(job: Job): string | null {
  const parts = [job.siteAddress, job.siteCity, job.siteState, job.siteZip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FieldScheduleView({ employeeId, onCompleteSession }: Props) {
  const [view, setView] = useState<"today" | "3day">("today");
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const [phases, setPhases] = useState<Map<string, CostingPhase>>(new Map());
  const [loading, setLoading] = useState(true);

  // ── Query sessions for this employee ─────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(db, "scheduleSessions"),
      where("assignedCrewIds", "array-contains", employeeId),
      where("status", "in", ["tentative", "confirmed", "in-progress"]),
      orderBy("startDate", "asc")
    );
    return onSnapshot(q, (snap) => {
      setSessions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleSession, "id">) }))
      );
      setLoading(false);
    });
  }, [employeeId]);

  // ── Fetch job details for addresses ──────────────────────────────────────

  useEffect(() => {
    const jobIds = [...new Set(sessions.map((s) => s.jobId))];
    if (jobIds.length === 0) {
      setJobs(new Map());
      return;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < jobIds.length; i += 30) chunks.push(jobIds.slice(i, i + 30));

    const unsubs: (() => void)[] = [];
    const jobsByChunk = new Map<number, Job[]>();

    chunks.forEach((chunk, idx) => {
      const q = query(collection(db, "Jobs"), where("__name__", "in", chunk));
      const unsub = onSnapshot(q, (snap) => {
        jobsByChunk.set(
          idx,
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
        );
        const all = new Map<string, Job>();
        for (const arr of jobsByChunk.values()) {
          for (const j of arr) all.set(j.id, j);
        }
        setJobs(all);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [sessions]);

  // ── Fetch costing phases for capacity info ───────────────────────────────

  useEffect(() => {
    const phaseIds = [...new Set(sessions.filter((s) => s.sessionType === "phase-work").map((s) => s.costingPhaseId))];
    if (phaseIds.length === 0) {
      setPhases(new Map());
      return;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < phaseIds.length; i += 30) chunks.push(phaseIds.slice(i, i + 30));

    const unsubs: (() => void)[] = [];
    const phasesByChunk = new Map<number, CostingPhase[]>();

    chunks.forEach((chunk, idx) => {
      const q = query(collection(db, "costingPhases"), where("__name__", "in", chunk));
      const unsub = onSnapshot(q, (snap) => {
        phasesByChunk.set(
          idx,
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostingPhase, "id">) }))
        );
        const all = new Map<string, CostingPhase>();
        for (const arr of phasesByChunk.values()) {
          for (const p of arr) all.set(p.id, p);
        }
        setPhases(all);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [sessions]);

  // ── Compute dates and group sessions ─────────────────────────────────────

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const viewDates = useMemo(() => {
    if (view === "today") return [today];
    return [today, ...getNextBusinessDays(2)];
  }, [view, today]);

  const sessionsByDate = useMemo(() => {
    const groups: Array<{ date: Date; sessions: ScheduleSession[] }> = [];
    for (const date of viewDates) {
      const daySessions = sessions.filter((s) => sessionCoversDate(s, date));
      groups.push({ date, sessions: daySessions });
    }
    return groups;
  }, [sessions, viewDates]);

  const isToday = (d: Date) => {
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toggle: Today / 3 Days */}
      <div className="flex gap-2">
        {(["today", "3day"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              view === v
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v === "today" ? "Today" : "3 Days"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      ) : (
        sessionsByDate.map(({ date, sessions: daySessions }) => (
          <div key={date.toISOString()}>
            {/* Date header (always show in 3-day view, skip in today view) */}
            {view === "3day" && (
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                {dateLabel(date)}
              </h3>
            )}

            {daySessions.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center shadow-sm">
                <p className="text-sm text-gray-400">
                  {isToday(date) ? "No sessions scheduled for today." : "No sessions."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {daySessions.map((sess) => {
                  const job = jobs.get(sess.jobId);
                  const phase = phases.get(sess.costingPhaseId);
                  const mapsUrl = job ? buildMapsUrl(job) : null;
                  const address = job ? buildAddressLine(job) : null;
                  const sessionCap = getSessionCapacity(sess);
                  const remaining = phase ? getRemainingHours(phase) : null;
                  const canComplete =
                    isToday(date) &&
                    (sess.status === "confirmed" || sess.status === "in-progress");

                  return (
                    <div
                      key={sess.id}
                      className={`rounded-xl border bg-white shadow-sm ${
                        sess.status === "tentative"
                          ? "border-dashed border-gray-300"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="p-4 space-y-2.5">
                        {/* Job name + status */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/jobs/${sess.jobId}`}
                            className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {sess.jobName}
                          </Link>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SESSION_STATUS_COLORS[sess.status]}`}
                          >
                            {SESSION_STATUS_LABELS[sess.status]}
                          </span>
                        </div>

                        {/* Address with map pin */}
                        {address && (
                          <div className="flex items-start gap-1.5">
                            <svg
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                              />
                            </svg>
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                {address}
                              </a>
                            ) : (
                              <span className="text-sm text-gray-600">{address}</span>
                            )}
                          </div>
                        )}

                        {/* Phase + session type */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-medium text-gray-700">
                            {sess.sessionType === "phase-work"
                              ? sess.phaseLabel
                              : SESSION_TYPE_LABELS[sess.sessionType]}
                          </span>
                          {sess.sessionType !== "phase-work" && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                              {SESSION_TYPE_LABELS[sess.sessionType]}
                            </span>
                          )}
                        </div>

                        {/* Crew */}
                        <div className="flex flex-wrap gap-1.5">
                          {sess.assignedCrew.map((c) => (
                            <span
                              key={c.employeeId}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                c.employeeId === employeeId
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {c.employeeName}
                            </span>
                          ))}
                        </div>

                        {/* Capacity */}
                        {sess.sessionType === "phase-work" && remaining !== null && (
                          <CapacityBadge
                            sessionCapacity={sessionCap}
                            remainingHours={remaining}
                            compact
                          />
                        )}

                        {/* Notes */}
                        {sess.note && (
                          <p className="text-xs text-gray-500 italic">
                            {sess.note}
                          </p>
                        )}

                        {/* Complete Session button */}
                        {canComplete && onCompleteSession && (
                          <button
                            type="button"
                            onClick={() => onCompleteSession(sess)}
                            className="mt-1 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                          >
                            Complete Session
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
