"use client";

import { SESSION_TYPE_LABELS, type ScheduleSession } from "@/types/scheduling";

// 10 distinct job colors — assigned by jobColorMap from parent
const JOB_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", muted: "text-blue-500" },
  { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", muted: "text-emerald-500" },
  { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", muted: "text-amber-500" },
  { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", muted: "text-purple-500" },
  { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", muted: "text-rose-500" },
  { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800", muted: "text-cyan-500" },
  { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", muted: "text-orange-500" },
  { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", muted: "text-indigo-500" },
  { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-800", muted: "text-teal-500" },
  { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-800", muted: "text-pink-500" },
];

export { JOB_COLORS };

/** Get initials from an employee name like "Josh Thompson" → "JT" */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface Props {
  session: ScheduleSession;
  colorIndex: number;
  onClick: () => void;
  // Drag & drop
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export default function SessionCard({
  session,
  colorIndex,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
}: Props) {
  if (session.status === "cancelled") return null;

  const color = JOB_COLORS[colorIndex % JOB_COLORS.length];
  const isCompleted = session.status === "completed";
  const isTentative = session.status === "tentative";

  // Crew display: initials if ≤3, count otherwise
  const crewDisplay =
    session.assignedCrew.length <= 3
      ? session.assignedCrew.map((c) => initials(c.employeeName)).join(", ")
      : `${session.assignedCrew.length} crew`;

  // Phase or session type label
  const typeLabel =
    session.sessionType === "phase-work"
      ? session.phaseLabel
      : SESSION_TYPE_LABELS[session.sessionType];

  const baseColor = isCompleted
    ? "bg-gray-50 border-gray-200 text-gray-400"
    : isTentative
    ? `${color.bg} border-dashed ${color.border}`
    : `${color.bg} ${color.border}`;

  const opacityClass = isDragging ? "opacity-40" : isTentative ? "opacity-80" : "";
  const dragClass = onDragStart ? "cursor-grab active:cursor-grabbing" : "";
  const ringClass = isDragging ? "ring-2 ring-blue-400 ring-inset" : "";

  return (
    <button
      type="button"
      draggable={!!onDragStart}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`w-full text-left rounded px-1.5 py-1 text-[10px] leading-tight border transition-colors truncate hover:shadow-sm ${baseColor} ${opacityClass} ${ringClass} ${dragClass}`}
    >
      <div className={`font-semibold truncate ${isCompleted ? "text-gray-500" : color.text}`}>
        {session.jobName}
      </div>
      <div className={`flex items-center gap-1 ${isCompleted ? "text-gray-400" : color.muted}`}>
        <span className="truncate">{typeLabel}</span>
        <span className="opacity-50">·</span>
        <span className="whitespace-nowrap">{crewDisplay}</span>
      </div>
    </button>
  );
}
