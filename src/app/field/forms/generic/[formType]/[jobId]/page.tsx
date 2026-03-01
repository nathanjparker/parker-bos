"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface FormConfig {
  name: string;
  icon: string;
  desc: string;
}

const FORM_CONFIGS: Record<string, FormConfig> = {
  "po-request":       { name: "PO Request",          icon: "📦", desc: "Request a material purchase order" },
  "inspection":       { name: "Inspection Request",  icon: "🔍", desc: "Request a plumbing or health inspection" },
  "daily-report":     { name: "Daily Report",        icon: "📝", desc: "End-of-day field report and notes" },
  "accident":         { name: "Accident / Incident", icon: "🚨", desc: "Report a jobsite safety incident" },
  "time-off":         { name: "Time Off Request",    icon: "🗓️", desc: "Submit PTO or time off" },
  "material-receipt": { name: "Material Receipt",    icon: "🧾", desc: "Log received materials on site" },
};

interface JobSummary {
  jobNumber: string;
  jobName: string;
}

const labelCls = "block text-sm font-medium text-[#8B90A0] mb-1.5";

export default function GenericFormPage() {
  const { formType, jobId } = useParams<{ formType: string; jobId: string }>();
  const router = useRouter();

  const config = FORM_CONFIGS[formType] ?? {
    name: formType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: "📋",
    desc: "Submit this form",
  };

  const [job, setJob] = useState<JobSummary | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "Jobs", jobId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as Record<string, string>;
        setJob({ jobNumber: d.jobNumber ?? "", jobName: d.jobName ?? "" });
      }
    });
  }, [jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!details.trim()) {
      setError("Please enter some details.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("You must be signed in.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await addDoc(collection(db, "formSubmissions"), {
        formType,
        jobId,
        jobNumber: job?.jobNumber ?? "",
        jobName: job?.jobName ?? "",
        submittedBy: user.uid,
        submittedByName: user.displayName ?? user.email ?? "",
        details: details.trim(),
        attachments: [],
        status: "Submitted",
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)] text-4xl">
          {config.icon}
        </div>
        <h2 className="text-xl font-bold text-[#F1F3F7]">Submitted!</h2>
        <p className="mt-2 text-sm text-[#8B90A0]">
          Your {config.name.toLowerCase()} has been received.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/field/jobs/${jobId}`)}
          className="mt-8 w-full max-w-xs rounded-2xl bg-[#3B82F6] px-6 py-3.5 text-base font-semibold text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/field/jobs/${jobId}`)}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#3B82F6]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[rgba(59,130,246,0.12)] text-3xl">
          {config.icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#F1F3F7]">{config.name}</h1>
          <p className="text-sm text-[#8B90A0]">{config.desc}</p>
        </div>
      </div>

      {/* Job context */}
      {job && (
        <div className="mb-5 rounded-2xl bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#3B82F6]">Job</div>
          <div className="mt-0.5 text-sm font-semibold text-[#F1F3F7]">
            {job.jobNumber && `${job.jobNumber} · `}{job.jobName}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelCls}>Details</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={6}
            placeholder="Describe the request or situation…"
            className="w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-base text-[#F1F3F7] placeholder-[#585D6E] outline-none focus:border-[#3B82F6] resize-y min-h-[140px] transition-colors"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm text-[#EF4444]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[#3B82F6] py-4 text-base font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : `Submit ${config.name}`}
        </button>
      </form>
    </div>
  );
}
