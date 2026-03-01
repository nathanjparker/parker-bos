"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFieldContext } from "@/lib/fieldContext";
import StatusBadge from "@/components/field/StatusBadge";
import type { Job } from "@/types/jobs";

interface ChangeOrder {
  id: string;
  coNumber: string;
  subject: string;
  status: string;
  createdAt?: { toDate?: () => Date } | null;
}

function fmtDate(d?: { toDate?: () => Date } | null): string {
  if (!d?.toDate) return "";
  return d.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Contact row — shows name/role and optional tap-to-call
function ContactRow({
  role,
  name,
  phone,
}: {
  role: string;
  name?: string;
  phone?: string;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2)
    : "—";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2A2E3B] last:border-0">
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          name
            ? "bg-[rgba(59,130,246,0.12)] text-[#3B82F6]"
            : "bg-[#222633] text-[#585D6E]"
        }`}
      >
        {initials}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
          {role}
        </div>
        <div
          className={`text-sm font-medium truncate ${
            name ? "text-[#F1F3F7]" : "text-[#585D6E] italic"
          }`}
        >
          {name ?? "Not assigned"}
        </div>
      </div>

      {/* Call button */}
      {name && phone && (
        <a
          href={`tel:${phone}`}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(34,197,94,0.12)] transition-colors active:bg-[rgba(34,197,94,0.2)]"
          aria-label={`Call ${name}`}
        >
          <svg
            className="h-5 w-5 text-[#22C55E]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
        </a>
      )}
    </div>
  );
}

export default function FieldJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setCurrentJob } = useFieldContext();

  const [job, setJob] = useState<Job | null>(null);
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Load job
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "Jobs", id), (snap) => {
      if (!snap.exists()) {
        setJob(null);
        setLoading(false);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as Omit<Job, "id">) };
      setJob(data);
      setCurrentJob({
        id: snap.id,
        jobNumber: (snap.data() as Record<string, string>).jobNumber ?? "",
        jobName: (snap.data() as Record<string, string>).jobName ?? "",
      });
      setLoading(false);
    });
    return () => unsub();
  }, [id, setCurrentJob]);

  // Clear job context when leaving
  useEffect(() => {
    return () => setCurrentJob(null);
  }, [setCurrentJob]);

  // Load change orders
  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      where("jobId", "==", id),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCos(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChangeOrder, "id">),
        }))
      );
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm text-[#3B82F6]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <p className="text-[#8B90A0]">Job not found.</p>
      </div>
    );
  }

  const jobNumber = (job as unknown as Record<string, string>).jobNumber ?? "";
  const fullAddress = [
    job.siteAddress,
    job.siteCity,
    job.siteState,
    job.siteZip,
  ]
    .filter(Boolean)
    .join(", ");

  const mapsUrl = fullAddress
    ? `https://maps.apple.com/?q=${encodeURIComponent(fullAddress)}`
    : null;

  const pendingCOs = cos.filter(
    (co) => co.status === "Draft" || co.status === "Submitted" || co.status === "Under Review"
  );

  return (
    <div className="px-4 pt-5 pb-6">
      {/* Back + header */}
      <button
        type="button"
        onClick={() => router.push("/field/jobs")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#3B82F6]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Jobs
      </button>

      {/* Job title block */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          {jobNumber && (
            <span className="font-mono text-xs font-bold text-[#3B82F6]">
              {jobNumber}
            </span>
          )}
          <StatusBadge status={job.projectPhase} size="sm" />
          {pendingCOs.length > 0 && (
            <span className="rounded-full bg-[rgba(234,179,8,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#EAB308]">
              {pendingCOs.length} pending CO{pendingCOs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-[#F1F3F7]">{job.jobName}</h1>
        {job.gcName && (
          <p className="mt-0.5 text-sm text-[#8B90A0]">{job.gcName}</p>
        )}
      </div>

      {/* Address */}
      {fullAddress && (
        <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27]">
          <a
            href={mapsUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)]">
              <svg
                className="h-5 w-5 text-[#3B82F6]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[#F1F3F7]">
                {job.siteAddress}
              </div>
              <div className="text-xs text-[#8B90A0]">
                {[job.siteCity, job.siteState, job.siteZip]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
            <svg
              className="h-4 w-4 text-[#585D6E]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </a>
        </div>
      )}

      {/* Key Contacts */}
      <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4">
        <div className="flex items-center gap-2 py-3 border-b border-[#2A2E3B]">
          <span className="text-xs font-bold uppercase tracking-widest text-[#585D6E]">
            Key Contacts
          </span>
        </div>
        <ContactRow
          role="Project Manager"
          name={job.pmName}
          phone={job.projectManagerPhone}
        />
        <ContactRow
          role="Estimator"
          name={job.estimatorName}
          phone={job.estimatorPhone}
        />
        <ContactRow
          role="Superintendent"
          name={job.superintendentName}
          phone={job.superintendentPhone}
        />
      </div>

      {/* Change Orders */}
      <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2E3B]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#585D6E]">
              Change Orders
            </span>
            {cos.length > 0 && (
              <span className="rounded-full bg-[rgba(59,130,246,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#3B82F6]">
                {cos.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/field/forms/change-order/${id}`)}
            className="text-xs font-semibold text-[#3B82F6]"
          >
            + New CO
          </button>
        </div>

        {cos.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[#585D6E]">
            No change orders yet.
          </div>
        ) : (
          <div>
            {cos.map((co) => (
              <div
                key={co.id}
                className="flex items-start gap-3 px-4 py-3.5 border-b border-[#2A2E3B] last:border-0"
              >
                <span className="mt-0.5 font-mono text-xs font-bold text-[#3B82F6] whitespace-nowrap">
                  {co.coNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#F1F3F7] truncate">
                    {co.subject}
                  </div>
                  {co.createdAt && (
                    <div className="text-xs text-[#585D6E]">
                      {fmtDate(co.createdAt)}
                    </div>
                  )}
                </div>
                <StatusBadge status={co.status} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
