"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const fieldFormSchema = z.object({
  jobId: z.string().min(1, "Select a job"),
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

type FieldChangeOrderFormValues = z.infer<typeof fieldFormSchema>;

type JobOption = {
  id: string;
  jobNumber: string;
  jobName: string;
  projectPhase?: string;
};

type FieldChangeOrderFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

const LABOR_BURDEN = 120;
const LABOR_BILLING_RATE = 250;
const MATERIAL_MARKUP_PCT = 30; // materialMarkedUp = materialCost * (1 + 30/100) = materialCost * 1.30

export function FieldChangeOrderForm({
  onSuccess,
  onCancel,
}: FieldChangeOrderFormProps) {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FieldChangeOrderFormValues>({
    resolver: zodResolver(fieldFormSchema),
    defaultValues: {
      jobId: "",
      subject: "",
      description: "",
      laborHours: 0,
      materialCost: 0,
    },
  });

  async function handleEnhanceDescription() {
    const description = getValues("description");
    const text = typeof description === "string" ? description.trim() : "";
    if (!text) {
      setEnhanceError("Enter some description text first, then click Enhance.");
      return;
    }
    setEnhanceError(null);
    setEnhancing(true);
    try {
      const jobId = getValues("jobId");
      const jobName = jobId ? jobs.find((j) => j.id === jobId)?.jobName : undefined;
      const res = await fetch("/api/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: text,
          subject: getValues("subject") || undefined,
          jobName: jobName || undefined,
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

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        const q = query(
          collection(db, "Jobs"),
          where("projectPhase", "==", "Active")
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const list: JobOption[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            jobNumber: (d.jobNumber as string) ?? "",
            jobName: (d.jobName as string) ?? "",
            projectPhase: d.projectPhase as string | undefined,
          };
        });
        setJobs(list);
      } catch (err) {
        console.error("Failed to load jobs:", err);
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setJobsLoading(false);
      }
    }

    loadJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(data: FieldChangeOrderFormValues) {
    const user = auth.currentUser;
    if (!user) {
      setSubmitError("You must be signed in to create a change order.");
      return;
    }

    const selectedJob = jobs.find((j) => j.id === data.jobId);
    if (!selectedJob) {
      setSubmitError("Selected job not found.");
      return;
    }

    const laborCost = data.laborHours * LABOR_BURDEN;
    const laborBilling = data.laborHours * LABOR_BILLING_RATE;
    const laborMarkedUp = laborBilling;
    const materialMarkedUp = data.materialCost * (1 + MATERIAL_MARKUP_PCT / 100);
    const subMarkedUp = 0;
    const amountRequested = laborCost + data.materialCost;
    const amountApproved = laborMarkedUp + materialMarkedUp;

    setSubmitError(null);
    setSubmitting(true);

    try {
      // Generate next CO number for this job: CO-01, CO-02, …
      const existingSnap = await getDocs(
        query(collection(db, "changeOrders"), where("jobId", "==", data.jobId))
      );
      const coNumber = `CO-${String(existingSnap.size + 1).padStart(2, "0")}`;

      await addDoc(collection(db, "changeOrders"), {
        coNumber,
        jobId: data.jobId,
        jobNumber: selectedJob.jobNumber,
        jobName: selectedJob.jobName,
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
        laborMarkedUp,
        materialMarkedUp,
        subMarkedUp,
        amountRequested,
        amountApproved,
        status: "Draft",
        requestedBy: user.uid,
        requestedByName: user.displayName ?? user.email ?? "",
        supportingDocs: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create change order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="field-co-job" className="block text-sm font-medium text-gray-700">
            Job
          </label>
          <select
            id="field-co-job"
            {...register("jobId")}
            disabled={jobsLoading}
            className="mt-1.5 block w-full min-h-[48px] rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-0 disabled:bg-gray-50"
          >
            <option value="">
              {jobsLoading ? "Loading jobs…" : "Select a job"}
            </option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.jobNumber} — {job.jobName}
              </option>
            ))}
          </select>
          {errors.jobId && (
            <p className="mt-1 text-sm text-red-600">{errors.jobId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="field-co-subject" className="block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            id="field-co-subject"
            type="text"
            {...register("subject")}
            className="mt-1.5 block w-full min-h-[48px] rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-0"
            placeholder="Short title for this change"
          />
          {errors.subject && (
            <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="field-co-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <button
              type="button"
              onClick={handleEnhanceDescription}
              disabled={enhancing || submitting}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
            >
              {enhancing ? "Enhancing…" : "✨ Enhance with AI"}
            </button>
          </div>
          <textarea
            id="field-co-description"
            {...register("description")}
            rows={4}
            disabled={enhancing}
            className="mt-1.5 block w-full min-h-[120px] resize-y rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-0 disabled:bg-gray-50 disabled:text-gray-600"
            placeholder="What changed? (min 10 characters)"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {errors.description.message}
            </p>
          )}
          {enhanceError && (
            <p className="mt-1.5 text-sm text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
              {enhanceError}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-4 space-y-4">
          <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Labor & material
          </h3>
          <div>
            <label htmlFor="field-co-labor" className="block text-sm font-medium text-gray-700">
              Labor hours
            </label>
            <input
              id="field-co-labor"
              type="number"
              inputMode="decimal"
              step="0.25"
              min={0}
              {...register("laborHours", { valueAsNumber: true })}
              className="mt-1.5 block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-0"
            />
          </div>
          <div>
            <label htmlFor="field-co-material" className="block text-sm font-medium text-gray-700">
              Material cost estimate
            </label>
            <div className="mt-1.5 flex min-h-[48px] rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-500 focus-within:ring-offset-0">
              <span className="flex items-center rounded-l-lg border-r border-gray-300 bg-gray-50 px-3 py-3 text-base text-gray-600">
                $
              </span>
              <input
                id="field-co-material"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                {...register("materialCost", { valueAsNumber: true })}
                className="min-w-0 flex-1 rounded-r-lg border-0 bg-transparent py-3 pr-4 pl-2 text-base text-gray-900 focus:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[48px] w-full rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-1"
        >
          {submitting ? "Saving…" : "Create change order"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-1"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
