"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ChangeOrderReview } from "@/components/ChangeOrderReview";
import { db } from "@/lib/firebase";

type COStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Executed"
  | "Billed";

const CO_STATUSES: COStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Executed",
  "Billed",
];

const STATUS_BADGE_CLASS: Record<COStatus, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Submitted: "bg-blue-100 text-blue-800",
  "Under Review": "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Executed: "bg-purple-100 text-purple-800",
  Billed: "bg-teal-100 text-teal-800",
};

type ChangeOrderRow = {
  id: string;
  coNumber: string;
  jobNumber: string;
  jobName: string;
  subject: string;
  description: string;
  amountRequested: number;
  amountApproved: number;
  status: COStatus;
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}

export default function ChangeOrdersPage() {
  const [rows, setRows] = useState<ChangeOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [reviewCoId, setReviewCoId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ChangeOrderRow[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            coNumber: (d.coNumber as string) ?? "",
            jobNumber: (d.jobNumber as string) ?? "",
            jobName: (d.jobName as string) ?? "",
            subject: (d.subject as string) ?? "",
            description: (d.description as string) ?? "",
            amountRequested: Number(d.amountRequested) ?? 0,
            amountApproved: Number(d.amountApproved) ?? 0,
            status: (d.status as COStatus) ?? "Draft",
          };
        });
        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.error("changeOrders onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredRows = useMemo(() => {
    let list = rows;

    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.coNumber.toLowerCase().includes(term) ||
          r.jobNumber.toLowerCase().includes(term) ||
          r.jobName.toLowerCase().includes(term) ||
          (r.subject && r.subject.toLowerCase().includes(term)) ||
          (r.description && r.description.toLowerCase().includes(term))
      );
    }

    return list;
  }, [rows, statusFilter, search]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pendingReview = rows.filter(
      (r) => r.status === "Submitted" || r.status === "Under Review"
    ).length;
    const approved = rows.filter((r) => r.status === "Approved").length;
    const totalApprovedValue = rows
      .filter((r) => r.status === "Approved")
      .reduce((sum, r) => sum + r.amountApproved, 0);

    return { total, pendingReview, approved, totalApprovedValue };
  }, [rows]);

  async function handleSubmit(coId: string) {
    setSubmittingId(coId);
    try {
      const ref = doc(db, "changeOrders", coId);
      await updateDoc(ref, {
        status: "Submitted",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to submit CO:", err);
    } finally {
      setSubmittingId(null);
    }
  }

  function openReview(id: string) {
    setReviewCoId(id);
  }

  function closeReview() {
    setReviewCoId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Change Orders</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review and manage change orders.
            </p>
          </div>
          <Link
            href="/change-orders/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + New CO
          </Link>
        </div>

        {/* Summary cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total COs
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Pending Review
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {summary.pendingReview}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Approved
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {summary.approved}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total Approved Value
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatCurrency(summary.totalApprovedValue)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {CO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by CO #, job, subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              Loading change orders…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {rows.length === 0
                  ? "No change orders yet. Create one to get started."
                  : "No change orders match the current filters."}
              </p>
              {rows.length === 0 && (
                <Link
                  href="/change-orders/new"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + New CO
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    CO Number
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Job
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Subject
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Amount Requested
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Amount Approved
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Status
                  </th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openReview(row.id)}
                        className="text-left text-sm font-medium text-blue-600 hover:underline"
                      >
                        {row.coNumber || row.id}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {row.jobNumber} — {row.jobName}
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-sm text-gray-600">
                      {truncate(row.subject || row.description, 60)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(row.amountRequested)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(row.amountApproved)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE_CLASS[row.status]
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {row.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => handleSubmit(row.id)}
                          disabled={submittingId === row.id}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {submittingId === row.id ? "Submitting…" : "Submit"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reviewCoId && (
        <ChangeOrderReview
          coId={reviewCoId}
          onClose={closeReview}
        />
      )}
    </div>
  );
}
