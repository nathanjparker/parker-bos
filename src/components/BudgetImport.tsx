"use client";

import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  parseBudgetTSV,
  type CostingPhase,
  type ParsedPhaseRow,
} from "@/types/costing";
import type { CostCode } from "@/types/costCodes";

interface Props {
  jobId: string;
  jobName: string;
  existingPhases: CostingPhase[];
  onClose: () => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type DiffStatus = "added" | "updated" | "unchanged" | "removed";

interface DiffRow {
  costCode: string;
  label: string;
  status: DiffStatus;
  parsed?: ParsedPhaseRow;
  existing?: CostingPhase;
  hasActuals: boolean;
}

export default function BudgetImport({ jobId, jobName, existingPhases, onClose }: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedPhaseRow[]>([]);
  const [diff, setDiff] = useState<DiffRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Load cost codes from Firestore for sort order + label lookup
  useEffect(() => {
    getDocs(query(collection(db, "costCodes"), orderBy("sortOrder", "asc")))
      .then((snap) => {
        setCostCodes(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostCode, "id">) }))
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!text.trim()) {
      setParsed([]);
      setDiff([]);
      return;
    }
    const labelMap = new Map(costCodes.map((c) => [c.code, c.label]));
    const rows = parseBudgetTSV(text, labelMap.size > 0 ? labelMap : undefined);
    setParsed(rows);

    const contractedExisting = existingPhases.filter(
      (p) => p.subgrouping === "CONTRACTED WORK"
    );

    const existingMap = new Map(contractedExisting.map((p) => [p.costCode, p]));
    const parsedMap = new Map(rows.map((r) => [r.costCode, r]));

    const allCodes = new Set([
      ...existingMap.keys(),
      ...parsedMap.keys(),
    ]);

    const diffRows: DiffRow[] = [];
    for (const code of allCodes) {
      const existing = existingMap.get(code);
      const parsedRow = parsedMap.get(code);
      const hasActuals = !!(
        existing?.actualMaterials ||
        existing?.actualHours
      );

      if (parsedRow && !existing) {
        diffRows.push({ costCode: code, label: parsedRow.label, status: "added", parsed: parsedRow, hasActuals: false });
      } else if (!parsedRow && existing) {
        diffRows.push({ costCode: code, label: existing.label, status: "removed", existing, hasActuals });
      } else if (parsedRow && existing) {
        const changed =
          Math.abs(parsedRow.estMaterialCost - existing.estMaterialCost) > 0.01 ||
          Math.abs(parsedRow.estLaborCost - existing.estLaborCost) > 0.01 ||
          Math.abs(parsedRow.estHours - existing.estHours) > 0.01;
        diffRows.push({
          costCode: code,
          label: parsedRow.label,
          status: changed ? "updated" : "unchanged",
          parsed: parsedRow,
          existing,
          hasActuals,
        });
      }
    }

    // Sort by Firestore costCodes sortOrder, then alphabetical for unknowns
    const codeOrder = costCodes.map((c) => c.code);
    diffRows.sort((a, b) => {
      const ai = codeOrder.indexOf(a.costCode);
      const bi = codeOrder.indexOf(b.costCode);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.costCode.localeCompare(b.costCode);
    });

    setDiff(diffRows);
  }, [text, existingPhases, costCodes]);

  const hasWarnings = diff.some(
    (d) => d.hasActuals && (d.status === "removed" || d.status === "updated")
  );

  async function handleConfirm() {
    if (parsed.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const contractedExisting = existingPhases.filter(
        (p) => p.subgrouping === "CONTRACTED WORK"
      );

      // Build actuals map from existing phases (to preserve on re-import)
      const actualsMap = new Map(
        contractedExisting.map((p) => [
          p.costCode,
          {
            actualMaterials: p.actualMaterials,
            actualHours: p.actualHours,
            completedPct: p.completedPct,
            notes: p.notes,
          },
        ])
      );

      // Delete existing contracted work phases
      await Promise.all(
        contractedExisting.map((p) => deleteDoc(doc(db, "costingPhases", p.id)))
      );

      // Write new phases, preserving actuals for matching cost codes
      await Promise.all(
        parsed.map((row) => {
          const actuals = actualsMap.get(row.costCode);
          const payload: Record<string, unknown> = {
            jobId,
            jobName,
            costCode: row.costCode,
            label: row.label,
            subgrouping: "CONTRACTED WORK",
            estMaterialCost: row.estMaterialCost,
            estLaborCost: row.estLaborCost,
            estHours: row.estHours,
            mMarkup: row.mMarkup,
            lMarkup: row.lMarkup,
            contractValue: row.contractValue,
            importedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (actuals?.actualMaterials != null) payload.actualMaterials = actuals.actualMaterials;
          if (actuals?.actualHours != null) payload.actualHours = actuals.actualHours;
          if (actuals?.completedPct != null) payload.completedPct = actuals.completedPct;
          if (actuals?.notes) payload.notes = actuals.notes;
          return addDoc(collection(db, "costingPhases"), payload);
        })
      );

      onClose();
    } catch (err) {
      console.error("Budget import failed:", err);
      setError("Import failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (s: DiffStatus) => {
    switch (s) {
      case "added":     return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">+ New</span>;
      case "updated":   return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Updated</span>;
      case "removed":   return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Removed</span>;
      case "unchanged": return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">No change</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Budget</h2>
            <p className="text-xs text-gray-500 mt-0.5">{jobName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1">
          {/* Paste area */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Paste estimating data
            </label>
            <p className="text-[11px] text-gray-400 mb-2">
              Copy all rows from your estimating software (including header row is fine) and paste below.
              Zero-value rows are ignored automatically.
            </p>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste TSV data here…"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Preview / Diff */}
          {diff.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">
                {existingPhases.filter((p) => p.subgrouping === "CONTRACTED WORK").length > 0
                  ? "Changes preview"
                  : "Import preview"}
              </p>

              {hasWarnings && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  ⚠ Some phases have actuals entered. Updated phases will preserve actuals; removed phases will lose them.
                </div>
              )}

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Phase</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Est. Mat</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Est. Labor</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Hrs</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Contract</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {diff.map((row) => (
                      <tr
                        key={row.costCode}
                        className={
                          row.status === "removed"
                            ? "opacity-50 bg-red-50"
                            : row.status === "added"
                            ? "bg-green-50/50"
                            : ""
                        }
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          <span className="text-gray-400 mr-1.5">{row.costCode}</span>
                          {row.label}
                          {row.hasActuals && (
                            <span className="ml-1.5 text-amber-500" title="Has actuals entered">⚠</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                          {row.parsed ? formatCurrency(row.parsed.estMaterialCost) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                          {row.parsed ? formatCurrency(row.parsed.estLaborCost) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                          {row.parsed ? row.parsed.estHours : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 tabular-nums">
                          {row.parsed ? formatCurrency(row.parsed.contractValue) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {statusBadge(row.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals */}
                  {parsed.length > 0 && (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700 tabular-nums">
                          {formatCurrency(parsed.reduce((s, r) => s + r.estMaterialCost, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700 tabular-nums">
                          {formatCurrency(parsed.reduce((s, r) => s + r.estLaborCost, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700 tabular-nums">
                          {parsed.reduce((s, r) => s + r.estHours, 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                          {formatCurrency(parsed.reduce((s, r) => s + r.contractValue, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={parsed.length === 0 || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Importing…" : `Import ${parsed.length} phase${parsed.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
