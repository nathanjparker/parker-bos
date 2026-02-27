"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import type { ServiceEstimate } from "@/types/estimates";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ts: ServiceEstimate["createdAt"] | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_BADGE: Record<ServiceEstimate["status"], string> = {
  Draft:       "rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600",
  Opportunity: "rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700",
  Awarded:     "rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700",
  Lost:        "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600",
};

const TYPE_BADGE: Record<string, string> = {
  install:      "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700",
  construction: "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600",
};

type StatusFilter = "All" | ServiceEstimate["status"];

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<ServiceEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    if (showNewMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNewMenu]);

  useEffect(() => {
    const q = query(collection(db, "estimates"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEstimates(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceEstimate, "id">) }))
      );
      setLoading(false);
    });
  }, []);

  const filtered = filter === "All" ? estimates : estimates.filter((e) => e.status === filter);

  const tabs: StatusFilter[] = ["All", "Draft", "Opportunity", "Awarded", "Lost"];

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Estimates</h1>
            <p className="text-sm text-gray-500 mt-0.5">Service & install job estimates</p>
          </div>
          <div ref={newMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowNewMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              New Estimate
              <svg className="h-3.5 w-3.5 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            {showNewMenu && (
              <div className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-20 py-1">
                <button
                  type="button"
                  onClick={() => { setShowNewMenu(false); router.push("/estimates/new"); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Install</span>
                  Install Estimate
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewMenu(false); router.push("/estimates/construction/new"); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Build</span>
                  Construction Estimate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                filter === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              {t !== "All" && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({estimates.filter((e) => e.status === t).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-gray-400">
                {filter === "All" ? "No estimates yet." : `No ${filter} estimates.`}
              </p>
              {filter === "All" && (
                <Link
                  href="/estimates/new"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Create your first estimate
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Job</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Contract Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Margin</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map((est) => (
                  <tr
                    key={est.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      const base = est.type === "construction" ? "/estimates/construction" : "/estimates";
                      window.location.href = `${base}/${est.id}`;
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {est.jobName || <span className="italic text-gray-400">Unnamed</span>}
                      {est.bidName && (
                        <span className="ml-1 text-gray-400 font-normal"> — {est.bidName}</span>
                      )}
                      {est.jobNumber && (
                        <span className="ml-1.5 text-xs text-gray-400">#{est.jobNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={TYPE_BADGE[est.type ?? "install"]}>
                        {est.type === "construction" ? "Build" : "Install"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={STATUS_BADGE[est.status]}>{est.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(est.totalContractValue)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {est.totalContractValue > 0 ? `${est.profitMargin.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {formatDate(est.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
