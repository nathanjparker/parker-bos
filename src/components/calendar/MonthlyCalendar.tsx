"use client";

import { useState } from "react";
import { doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SessionCard from "@/components/calendar/SessionCard";
import {
  checkCrewConflicts,
  SESSION_TYPE_LABELS,
  type ScheduleSession,
} from "@/types/scheduling";

interface Props {
  sessions: ScheduleSession[];
  currentMonth: Date;
  onSessionClick: (session: ScheduleSession) => void;
  onDayClick: (date: Date) => void;
  jobColorMap: Record<string, number>;
  /** Optional: highlight available (no-session) days for a specific employee */
  highlightAvailability?: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

/** Get all calendar dates for a month grid (includes padding from prev/next month) */
function getCalendarDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Date[] = [];

  // Pad start: days from previous month to fill first week
  const startPad = firstDay.getDay(); // 0 = Sunday
  for (let i = startPad - 1; i >= 0; i--) {
    dates.push(new Date(year, month, -i));
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    dates.push(new Date(year, month, d));
  }

  // Pad end: fill to complete last week (always 6 rows × 7 cols = 42 cells)
  while (dates.length < 42) {
    const next = dates.length - startPad - lastDay.getDate() + 1;
    dates.push(new Date(year, month + 1, next));
  }

  return dates;
}

/** Check if a date string (YYYY-MM-DD) matches */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Check if a session covers a specific date */
function sessionCoversDate(session: ScheduleSession, date: Date): boolean {
  const start = session.startDate?.toDate?.();
  const end = session.endDate?.toDate?.();
  if (!start || !end) return false;

  // Normalize to midnight for comparison
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (d < s || d > e) return false;

  // Skip weekends unless session includes them
  const dayOfWeek = d.getDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && !session.includesWeekend) return false;

  return true;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateRange(start: Date, end: Date): string {
  if (start.toDateString() === end.toDateString()) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

// ── Drag state types ─────────────────────────────────────────────────────────

interface DragInfo {
  sessionId: string;
  fromDateKey: string; // YYYY-MM-DD of the cell where drag started
}

interface PendingMove {
  session: ScheduleSession;
  newStart: Date;
  newEnd: Date;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MonthlyCalendar({
  sessions,
  currentMonth,
  onSessionClick,
  onDayClick,
  jobColorMap,
  highlightAvailability = false,
}: Props) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const dates = getCalendarDates(year, month);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // ── Drag & Drop State ─────────────────────────────────────────────────────

  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Drag & Drop Handlers ──────────────────────────────────────────────────

  function handleDragStart(
    e: React.DragEvent,
    session: ScheduleSession,
    fromDateKey: string
  ) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("sessionId", session.id);
    e.dataTransfer.setData("fromDateKey", fromDateKey);
    setDragInfo({ sessionId: session.id, fromDateKey });
  }

  function handleDragEnd() {
    setDragInfo(null);
    setDropTargetKey(null);
  }

  function handleDragOver(e: React.DragEvent, inMonth: boolean) {
    if (!inMonth || !dragInfo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(e: React.DragEvent, key: string, inMonth: boolean) {
    if (!inMonth || !dragInfo) return;
    e.preventDefault();
    setDropTargetKey(key);
  }

  function handleDragLeave(e: React.DragEvent, key: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropTargetKey((prev) => (prev === key ? null : prev));
  }

  async function handleDrop(
    e: React.DragEvent,
    targetDate: Date,
    inMonth: boolean
  ) {
    // Must read dataTransfer synchronously before any awaits
    e.preventDefault();
    const sessionId = e.dataTransfer.getData("sessionId");
    const fromDateKey = e.dataTransfer.getData("fromDateKey");

    setDragInfo(null);
    setDropTargetKey(null);

    if (!inMonth || !sessionId || !fromDateKey || saving) return;

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    // Parse the cell the drag started from
    const [fy, fm, fd] = fromDateKey.split("-").map(Number);
    const fromDate = new Date(fy, fm - 1, fd);
    const toDate = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );

    const offsetDays = Math.round(
      (toDate.getTime() - fromDate.getTime()) / 86400000
    );
    if (offsetDays === 0) return;

    const origStart = session.startDate.toDate();
    const origEnd = session.endDate.toDate();
    const newStart = new Date(origStart.getTime() + offsetDays * 86400000);
    const newEnd = new Date(origEnd.getTime() + offsetDays * 86400000);

    if (session.status === "confirmed") {
      setPendingMove({ session, newStart, newEnd });
    } else {
      await commitMove(session, newStart, newEnd);
    }
  }

  async function commitMove(
    session: ScheduleSession,
    newStart: Date,
    newEnd: Date
  ) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "scheduleSessions", session.id), {
        startDate: Timestamp.fromDate(newStart),
        endDate: Timestamp.fromDate(newEnd),
        updatedAt: serverTimestamp(),
      });

      // Toast notification
      setToast(`Session moved to ${fmtDateRange(newStart, newEnd)}`);
      setTimeout(() => setToast(null), 3000);

      // Check for crew conflicts after the move
      const updatedSession: Partial<ScheduleSession> = {
        ...session,
        startDate: Timestamp.fromDate(newStart),
        endDate: Timestamp.fromDate(newEnd),
      };
      const conflicts = await checkCrewConflicts(updatedSession, session.id);
      if (conflicts.length > 0) {
        const names = [
          ...new Set(conflicts.map((c) => c.employeeName)),
        ].join(", ");
        setConflictWarning(
          `Schedule conflict: ${names} ${
            conflicts.length === 1 ? "is" : "are"
          } already scheduled during this time.`
        );
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Calendar Data ─────────────────────────────────────────────────────────

  // Pre-compute sessions per day (only non-cancelled)
  const activeSessions = sessions.filter((s) => s.status !== "cancelled");
  const sessionsByDay = new Map<string, ScheduleSession[]>();
  for (const date of dates) {
    const key = dateKey(date);
    const daySessions = activeSessions.filter((s) => sessionCoversDate(s, date));
    if (daySessions.length > 0) sessionsByDay.set(key, daySessions);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Conflict warning banner */}
      {conflictWarning && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="flex-1">{conflictWarning}</span>
          <button
            type="button"
            onClick={() => setConflictWarning(null)}
            className="text-amber-600 hover:text-amber-800"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {dates.map((date, i) => {
            const key = dateKey(date);
            const inMonth = date.getMonth() === month;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const today = isToday(date);
            const daySessions = sessionsByDay.get(key) ?? [];
            const isExpanded = expandedDay === key;
            const hasOverflow = daySessions.length > MAX_VISIBLE;
            const visibleSessions = isExpanded
              ? daySessions
              : daySessions.slice(0, MAX_VISIBLE);
            const noSessions = daySessions.length === 0;
            const isDropTarget = dropTargetKey === key && inMonth;

            // Background color priority: drop target > out-of-month > weekend > available > default
            const bgClass = isDropTarget
              ? "bg-blue-50"
              : !inMonth
              ? "bg-gray-50/50"
              : isWeekend
              ? "bg-gray-50/80"
              : highlightAvailability && noSessions && !isWeekend
              ? "bg-green-50/40"
              : "bg-white";

            const ringClass = isDropTarget
              ? "ring-2 ring-inset ring-blue-300"
              : "";

            return (
              <div
                key={key + "-" + i}
                onDragOver={(e) => handleDragOver(e, inMonth)}
                onDragEnter={(e) => handleDragEnter(e, key, inMonth)}
                onDragLeave={(e) => handleDragLeave(e, key)}
                onDrop={(e) => handleDrop(e, date, inMonth)}
                className={`min-h-[100px] border-b border-r border-gray-100 p-1 transition-colors ${bgClass} ${ringClass}`}
              >
                {/* Day number — clickable to create session */}
                <button
                  type="button"
                  onClick={() => onDayClick(date)}
                  disabled={!inMonth}
                  className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                    today
                      ? "bg-blue-600 text-white"
                      : inMonth
                      ? "text-gray-700 hover:bg-gray-100"
                      : "text-gray-300 cursor-default"
                  }`}
                >
                  {date.getDate()}
                </button>

                {/* Session cards */}
                {inMonth && (
                  <div className="space-y-0.5">
                    {visibleSessions.map((sess) => (
                      <SessionCard
                        key={sess.id}
                        session={sess}
                        colorIndex={jobColorMap[sess.jobId] ?? 0}
                        onClick={() => onSessionClick(sess)}
                        onDragStart={(e) => handleDragStart(e, sess, key)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragInfo?.sessionId === sess.id}
                      />
                    ))}
                    {hasOverflow && !isExpanded && (
                      <button
                        type="button"
                        onClick={() => setExpandedDay(key)}
                        className="w-full rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        +{daySessions.length - MAX_VISIBLE} more
                      </button>
                    )}
                    {isExpanded && hasOverflow && (
                      <button
                        type="button"
                        onClick={() => setExpandedDay(null)}
                        className="w-full rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation modal — for confirmed sessions */}
      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Move Confirmed Session?
            </h3>
            <p className="mt-2 text-sm font-medium text-gray-800">
              {pendingMove.session.jobName}
              {" — "}
              {pendingMove.session.sessionType === "phase-work"
                ? pendingMove.session.phaseLabel
                : SESSION_TYPE_LABELS[pendingMove.session.sessionType]}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              <span className="line-through">
                {fmtDateRange(
                  pendingMove.session.startDate.toDate(),
                  pendingMove.session.endDate.toDate()
                )}
              </span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-medium text-gray-800">
                {fmtDateRange(pendingMove.newStart, pendingMove.newEnd)}
              </span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              This session is confirmed. Moving it will shift all dates by{" "}
              {Math.round(
                (pendingMove.newStart.getTime() -
                  pendingMove.session.startDate.toDate().getTime()) /
                  86400000
              )}{" "}
              day
              {Math.abs(
                Math.round(
                  (pendingMove.newStart.getTime() -
                    pendingMove.session.startDate.toDate().getTime()) /
                    86400000
                )
              ) !== 1
                ? "s"
                : ""}
              .
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const { session, newStart, newEnd } = pendingMove;
                  setPendingMove(null);
                  await commitMove(session, newStart, newEnd);
                }}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Moving…" : "Move Session"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingMove(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
