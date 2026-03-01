"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const schema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  laborHours: z
    .union([z.number(), z.nan()])
    .transform((n) => (Number.isNaN(n) ? 0 : n))
    .pipe(z.number().min(0)),
  materialCost: z
    .union([z.number(), z.nan()])
    .transform((n) => (Number.isNaN(n) ? 0 : n))
    .pipe(z.number().min(0)),
});

type FormValues = z.infer<typeof schema>;

const LABOR_BURDEN = 120;
const LABOR_BILLING_RATE = 250;
const MATERIAL_MARKUP_PCT = 30;

interface JobSummary {
  jobNumber: string;
  jobName: string;
}

// Reusable dark input/label styles
const inputCls =
  "w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-base text-[#F1F3F7] placeholder-[#585D6E] outline-none focus:border-[#3B82F6] transition-colors";
const labelCls = "block text-sm font-medium text-[#8B90A0] mb-1.5";

export default function FieldCOFormPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();

  const [job, setJob] = useState<JobSummary | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", description: "", laborHours: 0, materialCost: 0 },
  });

  // Load job
  useEffect(() => {
    getDoc(doc(db, "Jobs", jobId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as Record<string, string>;
        setJob({ jobNumber: d.jobNumber ?? "", jobName: d.jobName ?? "" });
      }
      setLoadingJob(false);
    });
  }, [jobId]);

  async function handleEnhance() {
    const description = getValues("description").trim();
    if (!description) {
      setEnhanceError("Enter a description first.");
      return;
    }
    setEnhanceError(null);
    setEnhancing(true);
    try {
      const res = await fetch("/api/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          subject: getValues("subject") || undefined,
          jobName: job?.jobName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnhanceError((data.error as string) || "Enhancement failed.");
        return;
      }
      if (typeof data.enhanced === "string") {
        setValue("description", data.enhanced);
        setEnhanceError(null);
      }
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : "Enhancement failed.");
    } finally {
      setEnhancing(false);
    }
  }

  async function onSubmit(data: FormValues) {
    const user = auth.currentUser;
    if (!user || !job) return;

    const laborCost = data.laborHours * LABOR_BURDEN;
    const laborBilling = data.laborHours * LABOR_BILLING_RATE;
    const materialMarkedUp = data.materialCost * (1 + MATERIAL_MARKUP_PCT / 100);
    const amountRequested = laborCost + data.materialCost;
    const amountApproved = laborBilling + materialMarkedUp;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const existingSnap = await getDocs(
        query(collection(db, "changeOrders"), where("jobId", "==", jobId))
      );
      const coNumber = `CO-${String(existingSnap.size + 1).padStart(2, "0")}`;

      await addDoc(collection(db, "changeOrders"), {
        coNumber,
        jobId,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        subject: data.subject.trim(),
        description: data.description.trim(),
        category: "Field Condition",
        laborHours: data.laborHours,
        laborBurden: LABOR_BURDEN,
        laborBillingRate: LABOR_BILLING_RATE,
        materialCost: data.materialCost,
        equipmentCost: 0,
        subcontractorCost: 0,
        otherCost: 0,
        materialMarkup: MATERIAL_MARKUP_PCT,
        subMarkup: 15,
        laborCost,
        laborBilling,
        laborMarkedUp: laborBilling,
        materialMarkedUp,
        subMarkedUp: 0,
        amountRequested,
        amountApproved,
        status: "Draft",
        requestedBy: user.uid,
        requestedByName: user.displayName ?? user.email ?? "",
        supportingDocs: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create change order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)]">
          <svg className="h-10 w-10 text-[#22C55E]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#F1F3F7]">Change Order Submitted</h2>
        <p className="mt-2 text-sm text-[#8B90A0]">
          Your CO has been submitted for review.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/field/jobs/${jobId}`)}
          className="mt-8 w-full max-w-xs rounded-2xl bg-[#3B82F6] px-6 py-3.5 text-base font-semibold text-white transition-colors active:bg-blue-700"
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#F1F3F7]">Change Order</h1>
        {loadingJob ? (
          <div className="mt-1 h-4 w-32 animate-pulse rounded bg-[#222633]" />
        ) : job ? (
          <p className="mt-0.5 text-sm text-[#8B90A0]">
            {job.jobNumber && `${job.jobNumber} · `}{job.jobName}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Subject */}
        <div>
          <label className={labelCls}>Subject</label>
          <input
            type="text"
            {...register("subject")}
            placeholder="Short title for this change"
            className={inputCls}
          />
          {errors.subject && (
            <p className="mt-1.5 text-sm text-[#EF4444]">{errors.subject.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls.replace("mb-1.5", "")}>Description</label>
            <button
              type="button"
              onClick={handleEnhance}
              disabled={enhancing || submitting}
              className="text-xs font-semibold text-[#3B82F6] disabled:opacity-40"
            >
              {enhancing ? "Enhancing…" : "✨ Enhance"}
            </button>
          </div>
          <textarea
            {...register("description")}
            rows={4}
            disabled={enhancing}
            placeholder="What changed? What's needed?"
            className={`${inputCls} resize-y min-h-[100px] disabled:opacity-60`}
          />
          {errors.description && (
            <p className="mt-1.5 text-sm text-[#EF4444]">{errors.description.message}</p>
          )}
          {enhanceError && (
            <p className="mt-1.5 rounded-xl bg-[rgba(234,179,8,0.1)] px-3 py-2 text-sm text-[#EAB308]">
              {enhanceError}
            </p>
          )}
        </div>

        {/* Labor & material */}
        <div className="rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] p-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#585D6E]">
            Labor & Material
          </h3>
          <div>
            <label className={labelCls}>Labor hours (estimate)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min={0}
              {...register("laborHours", { valueAsNumber: true })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Material cost (estimate)</label>
            <div className="flex rounded-xl border border-[#2A2E3B] bg-[#222633] focus-within:border-[#3B82F6] overflow-hidden">
              <span className="flex items-center border-r border-[#2A2E3B] px-3 text-[#585D6E] text-sm">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                {...register("materialCost", { valueAsNumber: true })}
                className="flex-1 bg-transparent py-3 pl-3 pr-4 text-base text-[#F1F3F7] outline-none"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <div className="rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm text-[#EF4444]">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[#3B82F6] py-4 text-base font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Change Order"}
        </button>
      </form>
    </div>
  );
}
