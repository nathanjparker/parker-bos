"use client";

import { getCapacityStatus, type CapacityStatus } from "@/types/scheduling";

interface Props {
  sessionCapacity: number;
  remainingHours: number;
  compact?: boolean;
}

const STATUS_STYLES: Record<CapacityStatus, { bg: string; icon: string }> = {
  sufficient: { bg: "bg-green-50 text-green-700 border-green-200", icon: "✓" },
  short: { bg: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: "⚠" },
  over: { bg: "bg-red-50 text-red-700 border-red-200", icon: "✗" },
};

export default function CapacityBadge({
  sessionCapacity,
  remainingHours,
  compact = false,
}: Props) {
  const { status, difference } = getCapacityStatus(sessionCapacity, remainingHours);
  const styles = STATUS_STYLES[status];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${styles.bg}`}
      >
        {Math.round(sessionCapacity)}h cap
        <span className="opacity-70">{styles.icon}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border ${styles.bg}`}
    >
      <span>{Math.round(sessionCapacity)} hrs capacity</span>
      <span className="opacity-50">·</span>
      <span>{Math.round(remainingHours)} hrs remaining</span>
      <span>{styles.icon}</span>
      {status !== "sufficient" && (
        <>
          <span className="opacity-50">·</span>
          <span className="font-semibold">
            {Math.abs(Math.round(difference))} hrs short
          </span>
        </>
      )}
    </span>
  );
}
