"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  type COStatus,
  LABOR_RATE_TIERS,
  MATERIAL_MARKUP_TIERS,
  suggestLaborRate,
  suggestMaterialMarkup,
} from "@/types/changeOrders";
import { auth, db } from "@/lib/firebase";

const STATUS_BADGE_CLASS: Record<COStatus, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Submitted: "bg-blue-100 text-blue-800",
  "Under Review": "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Executed: "bg-purple-100 text-purple-800",
  Billed: "bg-teal-100 text-teal-800",
};

type ChangeOrderReviewProps = {
  coId: string;
  onClose?: () => void;
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return new Date((value as { toDate: () => Date }).toDate()).toLocaleString();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toLocaleString();
  }
  return "—";
}

export function ChangeOrderReview({ coId, onClose }: ChangeOrderReviewProps) {
  const [co, setCo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Editable rates (only when status is Submitted or Under Review)
  const [laborBurden, setLaborBurden] = useState(120);
  const [laborBillingRate, setLaborBillingRate] = useState(250);
  const [materialMarkup, setMaterialMarkup] = useState(15);
  const [subMarkup, setSubMarkup] = useState(15);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const ref = doc(db, "changeOrders", coId);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (!snap.exists()) {
          setError("Change order not found.");
          setCo(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as Record<string, unknown>;
        setCo(data);

        const status = data.status as COStatus;
        if (status === "Submitted") {
          await updateDoc(ref, {
            status: "Under Review",
            underReviewAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) setCo((prev) => (prev ? { ...prev, status: "Under Review" } : null));
        }

        // Populate editable rates from CO
        const lb = Number(data.laborBurden) || 120;
        const lbr = Number(data.laborBillingRate) ?? suggestLaborRate(Number(data.laborHours) || 0);
        const mm = Number(data.materialMarkup) ?? suggestMaterialMarkup(Number(data.materialCost) || 0);
        const sm = Number(data.subMarkup) || 15;
        setLaborBurden(lb);
        setLaborBillingRate(lbr);
        setMaterialMarkup(mm);
        setSubMarkup(sm);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load change order.");
          setCo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [coId]);

  const totals = useMemo(() => {
    if (!co) return null;
    const hours = Number(co.laborHours) || 0;
    const burden = Number(laborBurden) || 0;
    const rate = Number(laborBillingRate) || 0;
    const mat = Number(co.materialCost) || 0;
    const matPct = Number(materialMarkup) || 0;
    const sub = Number(co.subcontractorCost) || 0;
    const other = Number(co.otherCost) || 0;
    const subPct = Number(subMarkup) || 0;

    const laborCost = hours * burden;
    const laborBilling = hours * rate;
    const laborMarkedUp = laborBilling;
    const materialMarkedUp = mat * (1 + matPct / 100);
    const subMarkedUp = (sub + other) * (1 + subPct / 100);
    const amountApproved = laborMarkedUp + materialMarkedUp + subMarkedUp;

    return {
      laborCost,
      laborBilling,
      laborMarkedUp,
      materialMarkedUp,
      subMarkedUp,
      amountApproved,
    };
  }, [co, laborBurden, laborBillingRate, materialMarkup, subMarkup]);

  async function handleApprove() {
    if (!co || !totals) return;
    const user = auth.currentUser;
    if (!user) return;
    setApproving(true);
    try {
      const ref = doc(db, "changeOrders", coId);
      await updateDoc(ref, {
        status: "Approved",
        laborBurden: laborBurden,
        laborBillingRate: laborBillingRate,
        materialMarkup: materialMarkup,
        subMarkup: subMarkup,
        laborCost: totals.laborCost,
        laborBilling: totals.laborBilling,
        laborMarkedUp: totals.laborMarkedUp,
        materialMarkedUp: totals.materialMarkedUp,
        subMarkedUp: totals.subMarkedUp,
        amountApproved: totals.amountApproved,
        approvedBy: user.uid,
        approvedByName: user.displayName ?? user.email ?? "",
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose?.();
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!co) return;
    setRejecting(true);
    try {
      const ref = doc(db, "changeOrders", coId);
      await updateDoc(ref, {
        status: "Rejected",
        rejectionReason: rejectionReason.trim() || undefined,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowRejectInput(false);
      setRejectionReason("");
      onClose?.();
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-white p-8 shadow-xl">
          <p className="text-sm text-gray-600">Loading change order…</p>
        </div>
      </div>
    );
  }

  if (error || !co) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
          <p className="text-sm text-red-600">{error ?? "Not found."}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = (co.status as COStatus) ?? "Draft";
  const canEditRates = status === "Submitted" || status === "Under Review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Change order — {(co.coNumber as string) || coId}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Close
            </button>
          )}
        </div>

        <div className="space-y-6 p-6">
          {/* Details (read-only) */}
          <div className="rounded-xl bg-slate-50 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Details
            </h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Job</dt>
                <dd className="font-medium text-gray-900">
                  {(co.jobNumber as string) ?? ""} — {(co.jobName as string) ?? ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Category</dt>
                <dd className="font-medium text-gray-900">{(co.category as string) ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Description</dt>
                <dd className="mt-0.5 font-medium text-gray-900 whitespace-pre-wrap">
                  {(co.description as string) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      STATUS_BADGE_CLASS[status]
                    }`}
                  >
                    {status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Requested by</dt>
                <dd className="font-medium text-gray-900">
                  {(co.requestedByName as string) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Date</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(co.createdAt)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Raw costs (read-only) */}
          <div className="rounded-xl bg-slate-50 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Raw costs
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">Labor</dt>
                <dd className="font-medium text-gray-900">
                  {Number(co.laborHours) ?? 0} hours
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Material</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(Number(co.materialCost) || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Equipment</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(Number(co.equipmentCost) || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Subcontractor</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(Number(co.subcontractorCost) || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Other</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(Number(co.otherCost) || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Amount requested</dt>
                <dd className="font-semibold text-gray-900">
                  {formatCurrency(Number(co.amountRequested) || 0)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Rates (editable only when Submitted or Under Review) */}
          <div className="rounded-xl bg-indigo-50 p-4">
            <h3 className="border-b border-indigo-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Rates & markup
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Labor Burden $/hr
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={laborBurden}
                  onChange={(e) => setLaborBurden(Number(e.target.value) || 0)}
                  disabled={!canEditRates}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Labor Billing Rate $/hr
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={laborBillingRate}
                  onChange={(e) => setLaborBillingRate(Number(e.target.value) || 0)}
                  disabled={!canEditRates}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Material Markup %
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={200}
                  value={materialMarkup}
                  onChange={(e) => setMaterialMarkup(Number(e.target.value) || 0)}
                  disabled={!canEditRates}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Sub Markup %
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={200}
                  value={subMarkup}
                  onChange={(e) => setSubMarkup(Number(e.target.value) || 0)}
                  disabled={!canEditRates}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Tier reference cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <h3 className="border-b border-emerald-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Labor rate tiers (suggested $/hr)
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {LABOR_RATE_TIERS.map((t) => (
                  <li key={t.label}>
                    {t.label}: {t.suggested}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <h3 className="border-b border-emerald-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Material markup tiers (suggested %)
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {MATERIAL_MARKUP_TIERS.map((t) => (
                  <li key={t.label}>
                    {t.label}: {t.suggested}%
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Live totals */}
          {totals && (
            <div className="rounded-xl bg-emerald-50 p-4">
              <h3 className="border-b border-emerald-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Calculated totals
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-gray-600">Labor cost</span>
                  <p className="font-medium text-gray-900">{formatCurrency(totals.laborCost)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Labor billing</span>
                  <p className="font-medium text-gray-900">{formatCurrency(totals.laborBilling)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Labor marked up</span>
                  <p className="font-medium text-gray-900">{formatCurrency(totals.laborMarkedUp)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Material marked up</span>
                  <p className="font-medium text-gray-900">{formatCurrency(totals.materialMarkedUp)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Sub marked up</span>
                  <p className="font-medium text-gray-900">{formatCurrency(totals.subMarkedUp)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Amount approved</span>
                  <p className="font-semibold text-emerald-800">{formatCurrency(totals.amountApproved)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rejection reason (inline when Reject clicked) */}
          {showRejectInput && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <label className="block text-sm font-medium text-gray-700">
                Rejection reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Optional reason for rejection..."
                className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejecting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {rejecting ? "Rejecting…" : "Confirm reject"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  disabled={rejecting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions: Approve / Reject (only when Under Review or Submitted) */}
          {canEditRates && !showRejectInput && (
            <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
              >
                {approving ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectInput(true)}
                disabled={approving}
                className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
