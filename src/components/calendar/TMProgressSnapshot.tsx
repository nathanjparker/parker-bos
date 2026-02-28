"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CostingPhase } from "@/types/costing";
import {
  BUDGET_WARNING_COLORS,
  BUDGET_WARNING_LABELS,
  getBudgetWarning,
} from "@/types/scheduling";

interface Props {
  jobId: string;
}

export default function TMProgressSnapshot({ jobId }: Props) {
  const [phases, setPhases] = useState<CostingPhase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "costingPhases"),
      where("jobId", "==", jobId),
      orderBy("importedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setPhases(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostingPhase, "id">) }))
      );
      setLoading(false);
    });
  }, [jobId]);

  // Only show contracted work phases
  const contracted = phases.filter((p) => p.subgrouping === "CONTRACTED WORK");

  // Totals
  const totalEst = contracted.reduce((s, p) => s + p.estHours, 0);
  const totalActual = contracted.reduce((s, p) => s + (p.actualHours ?? 0), 0);
  const overallPct =
    totalEst > 0
      ? Math.round(contracted.reduce((s, p) => s + p.estHours * (p.completedPct ?? 0), 0) / totalEst)
      : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (contracted.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">No budget phases imported.</p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Phase rows */}
      {contracted.map((p) => {
        const remaining = Math.round(p.estHours * (1 - (p.completedPct ?? 0) / 100));
        const pct = p.completedPct ?? 0;
        const warning = getBudgetWarning(p);

        return (
          <div
            key={p.id}
            className="rounded-lg border border-gray-100 bg-white px-3 py-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{p.label}</span>
                {warning !== "normal" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${BUDGET_WARNING_COLORS[warning]}`}
                  >
                    {BUDGET_WARNING_LABELS[warning]}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-gray-700 tabular-nums">
                {pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100
                    ? "bg-green-500"
                    : warning === "over-budget" || warning === "critical"
                    ? "bg-red-500"
                    : warning === "warning"
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>

            {/* Hours detail */}
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 tabular-nums">
              <span>{p.estHours}h budgeted</span>
              <span>{p.actualHours ?? 0}h actual</span>
              <span
                className={
                  remaining < 0 ? "text-red-600 font-semibold" : ""
                }
              >
                {remaining}h left
              </span>
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-xs font-bold text-gray-800 tabular-nums">
            {overallPct}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${Math.min(100, overallPct)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-600 tabular-nums font-medium">
          <span>{totalEst}h budgeted</span>
          <span>{totalActual}h actual</span>
          <span>{Math.round(totalEst - totalActual)}h left</span>
        </div>
      </div>
    </div>
  );
}
