"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";

const FIRESTORE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(not set)";

type StatCard = {
  label: string;
  value: string | number;
  href?: string;
  sub?: string;
};

export default function DashboardPage() {
  const [activeJobs, setActiveJobs] = useState(0);
  const [awardedJobs, setAwardedJobs] = useState(0);
  const [pendingCOs, setPendingCOs] = useState(0);
  const [approvedCOValue, setApprovedCOValue] = useState(0);

  // Active jobs count
  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "==", "Active")
    );
    return onSnapshot(
      q,
      (snap) => setActiveJobs(snap.size),
      (err) => console.error("Dashboard Jobs (Active) error:", err.message)
    );
  }, []);

  // Awarded jobs count
  useEffect(() => {
    const q = query(
      collection(db, "Jobs"),
      where("projectPhase", "==", "Awarded")
    );
    return onSnapshot(
      q,
      (snap) => setAwardedJobs(snap.size),
      (err) => console.error("Dashboard Jobs (Awarded) error:", err.message)
    );
  }, []);

  // COs pending review (Submitted or Under Review)
  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      where("status", "in", ["Submitted", "Under Review"])
    );
    return onSnapshot(
      q,
      (snap) => setPendingCOs(snap.size),
      (err) => console.error("Dashboard changeOrders (pending) error:", err.message)
    );
  }, []);

  // Total approved CO value
  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      where("status", "==", "Approved")
    );
    return onSnapshot(
      q,
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + (Number(d.data().amountApproved) || 0),
          0
        );
        setApprovedCOValue(total);
      },
      (err) => console.error("Dashboard changeOrders (approved) error:", err.message)
    );
  }, []);

  const stats: StatCard[] = useMemo(
    () => [
      {
        label: "Active Jobs",
        value: activeJobs,
        href: "/jobs",
        sub: awardedJobs > 0 ? `+${awardedJobs} awarded` : undefined,
      },
      {
        label: "COs Pending Review",
        value: pendingCOs,
        href: "/change-orders",
      },
      {
        label: "Approved CO Value",
        value: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(approvedCOValue),
        href: "/change-orders",
      },
    ],
    [activeJobs, awardedJobs, pendingCOs, approvedCOValue]
  );

  const modules = [
    {
      label: "Jobs",
      description: "Track all projects by phase, GC, and contract value.",
      href: "/jobs",
      available: true,
    },
    {
      label: "Change Orders",
      description: "Draft, price, and track approval for change orders.",
      href: "/change-orders",
      available: true,
    },
    {
      label: "Purchase Orders",
      description: "Create and track POs tied to jobs.",
      href: "/pos",
      available: false,
    },
    {
      label: "Files",
      description: "Store and retrieve job documents.",
      href: "/files",
      available: false,
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400" title="Must match Firebase Console project">
            Firestore: {FIRESTORE_PROJECT_ID}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {s.label}
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
              {s.sub && (
                <p className="mt-1 text-xs text-yellow-600 font-medium">{s.sub}</p>
              )}
              {s.href && (
                <Link
                  href={s.href}
                  className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline"
                >
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Modules */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Modules
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <Link
              key={m.label}
              href={m.available ? m.href : "#"}
              className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                m.available
                  ? "border-gray-200 hover:border-blue-200 hover:shadow-md"
                  : "border-gray-100 cursor-default opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {m.label}
                </h3>
                {!m.available && (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    Soon
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">{m.description}</p>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/jobs/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New Job
          </Link>
          <Link
            href="/change-orders/new"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            + New CO
          </Link>
          <Link
            href="/import"
            className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-400 hover:border-gray-400 hover:text-gray-600"
          >
            Airtable Import
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
