"use client";

import { useState } from "react";
import SessionCard from "@/components/calendar/SessionCard";
import type { ScheduleSession } from "@/types/scheduling";

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

  // Pre-compute sessions per day (only non-cancelled)
  const activeSessions = sessions.filter((s) => s.status !== "cancelled");
  const sessionsByDay = new Map<string, ScheduleSession[]>();
  for (const date of dates) {
    const key = dateKey(date);
    const daySessions = activeSessions.filter((s) => sessionCoversDate(s, date));
    if (daySessions.length > 0) sessionsByDay.set(key, daySessions);
  }

  return (
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {dates.map((date, i) => {
          const key = dateKey(date);
          const inMonth = date.getMonth() === month;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const today = isToday(date);
          const daySessions = sessionsByDay.get(key) ?? [];
          const isExpanded = expandedDay === key;
          const hasOverflow = daySessions.length > MAX_VISIBLE;
          const visibleSessions = isExpanded ? daySessions : daySessions.slice(0, MAX_VISIBLE);
          const noSessions = daySessions.length === 0;

          return (
            <div
              key={key + "-" + i}
              className={`min-h-[100px] border-b border-r border-gray-100 p-1 transition-colors ${
                !inMonth
                  ? "bg-gray-50/50"
                  : isWeekend
                  ? "bg-gray-50/80"
                  : highlightAvailability && noSessions && !isWeekend
                  ? "bg-green-50/40"
                  : "bg-white"
              }`}
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
  );
}
