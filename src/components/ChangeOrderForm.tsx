"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  type COCategory,
  LABOR_RATE_TIERS,
  MATERIAL_MARKUP_TIERS,
  suggestLaborRate,
  suggestMaterialMarkup,
} from "@/types/changeOrders";
import { auth, db } from "@/lib/firebase";

const CO_CATEGORIES: COCategory[] = [
  "Owner Change",
  "Field Condition",
  "Design Error",
  "Code Requirement",
  "Other",
];

const num = (def: number) =>
  z
    .union([z.number(), z.nan()])
    .transform((n) => (Number.isNaN(n) ? def : n))
    .pipe(z.number().min(0));

const pct = (def: number) =>
  z
    .union([z.number(), z.nan()])
    .transform((n) => (Number.isNaN(n) ? def : n))
    .pipe(z.number().min(0).max(200));

const changeOrderFormSchema = z.object({
  jobId: z.string().min(1, "Select a job"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(120),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum([
    "Owner Change",
    "Field Condition",
    "Design Error",
    "Code Requirement",
    "Other",
  ]),
  laborHours: num(0),
  laborBurden: num(120),
  laborBillingRate: num(250),
  materialCost: num(0),
  equipmentCost: num(0),
  subcontractorCost: num(0),
  otherCost: num(0),
  materialMarkup: pct(15),
  subMarkup: pct(15),
});

type ChangeOrderFormValues = z.infer<typeof changeOrderFormSchema>;

type JobOption = {
  id: string;
  jobNumber: string;
  jobName: string;
  projectPhase?: string;
};

type ChangeOrderFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function ChangeOrderForm({ onSuccess, onCancel }: ChangeOrderFormProps) {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ChangeOrderFormValues>({
    resolver: zodResolver(changeOrderFormSchema),
    defaultValues: {
      jobId: "",
      subject: "",
      description: "",
      category: "Other",
      laborHours: 0,
      laborBurden: 120,
      laborBillingRate: 250,
      materialCost: 0,
      equipmentCost: 0,
      subcontractorCost: 0,
      otherCost: 0,
      materialMarkup: 15,
      subMarkup: 15,
    },
  });

  const laborHours = watch("laborHours");
  const laborBurden = watch("laborBurden");
  const laborBillingRate = watch("laborBillingRate");
  const materialCost = watch("materialCost");
  const equipmentCost = watch("equipmentCost");
  const subcontractorCost = watch("subcontractorCost");
  const otherCost = watch("otherCost");
  const materialMarkup = watch("materialMarkup");
  const subMarkup = watch("subMarkup");

  // Auto-suggest laborBillingRate when laborHours changes
  useEffect(() => {
    const hours = Number(laborHours);
    if (!Number.isNaN(hours) && hours >= 0) {
      setValue("laborBillingRate", suggestLaborRate(hours));
    }
  }, [laborHours, setValue]);

  // Auto-suggest materialMarkup when materialCost changes
  useEffect(() => {
    const cost = Number(materialCost);
    if (!Number.isNaN(cost) && cost >= 0) {
      setValue("materialMarkup", suggestMaterialMarkup(cost));
    }
  }, [materialCost, setValue]);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      console.log("db object:", db);
      console.log("db type:", typeof db);
      console.log("collection ref:", collection(db, "Jobs"));
      try {
        console.log("Loading jobs from Firestore...");
        const q = query(
          collection(db, "Jobs"),
          where("projectPhase", "==", "Active")
        );
        const snapshot = await getDocs(q);
        console.log("Jobs snapshot size:", snapshot.size);
        console.log(
          "Jobs snapshot docs:",
          snapshot.docs.map((d) => d.data())
        );
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
        console.log("Mapped jobs:", list);
        console.log("Setting jobs state:", list);
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

  const totals = useMemo(() => {
    const hours = Number(laborHours) || 0;
    const burden = Number(laborBurden) || 0;
    const rate = Number(laborBillingRate) || 0;
    const mat = Number(materialCost) || 0;
    const matPct = Number(materialMarkup) || 0;
    const sub = Number(subcontractorCost) || 0;
    const other = Number(otherCost) || 0;
    const subPct = Number(subMarkup) || 0;
    const equip = Number(equipmentCost) || 0;

    const laborCost = hours * burden;
    const laborBilling = hours * rate;
    const laborMarkedUp = laborBilling;
    const materialMarkedUp = mat * (1 + matPct / 100);
    const subMarkedUp = (sub + other) * (1 + subPct / 100);
    const amountRequested =
      laborCost + mat + equip + sub + other;
    const amountApproved = laborMarkedUp + materialMarkedUp + subMarkedUp;

    return {
      laborCost,
      laborBilling,
      laborMarkedUp,
      materialMarkedUp,
      subMarkedUp,
      amountRequested,
      amountApproved,
    };
  }, [
    laborHours,
    laborBurden,
    laborBillingRate,
    materialCost,
    materialMarkup,
    subcontractorCost,
    otherCost,
    subMarkup,
    equipmentCost,
  ]);

  async function onSubmit(data: ChangeOrderFormValues) {
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

    const laborCost =
      data.laborHours * data.laborBurden;
    const laborBilling = data.laborHours * data.laborBillingRate;
    const laborMarkedUp = laborBilling;
    const materialMarkedUp =
      data.materialCost * (1 + data.materialMarkup / 100);
    const subMarkedUp =
      (data.subcontractorCost + data.otherCost) *
      (1 + data.subMarkup / 100);
    const amountRequested =
      laborCost +
      data.materialCost +
      data.equipmentCost +
      data.subcontractorCost +
      data.otherCost;
    const amountApproved = laborMarkedUp + materialMarkedUp + subMarkedUp;

    setSubmitError(null);
    setSubmitting(true);

    try {
      await addDoc(collection(db, "changeOrders"), {
        coNumber: "",
        jobId: data.jobId,
        jobNumber: selectedJob.jobNumber,
        jobName: selectedJob.jobName,
        subject: data.subject.trim(),
        description: data.description.trim(),
        category: data.category,
        laborHours: data.laborHours,
        laborBurden: data.laborBurden,
        laborBillingRate: data.laborBillingRate,
        materialCost: data.materialCost,
        equipmentCost: data.equipmentCost,
        subcontractorCost: data.subcontractorCost,
        otherCost: data.otherCost,
        materialMarkup: data.materialMarkup,
        subMarkup: data.subMarkup,
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
      className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Top section: Job, Category, Subject, Description */}
      <div className="rounded-xl bg-slate-50 p-4">
        <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Job
            </label>
            <select
              {...register("jobId")}
              disabled={jobsLoading}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-gray-100"
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
              <p className="mt-1 text-xs text-red-600">{errors.jobId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              {...register("category")}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {CO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              type="text"
              {...register("subject")}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Brief subject line for this change order"
            />
            {errors.subject && (
              <p className="mt-1 text-xs text-red-600">
                {errors.subject.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="mt-1.5 block w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Describe the scope of the change order (min 10 characters)"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Raw costs */}
      <div className="rounded-xl bg-slate-50 p-4">
        <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Raw costs
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Labor Hours
            </label>
            <input
              type="number"
              step="0.25"
              min={0}
              {...register("laborHours", { valueAsNumber: true })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          {(
            [
              ["materialCost", "Material"],
              ["equipmentCost", "Equipment"],
              ["subcontractorCost", "Subcontractor"],
              ["otherCost", "Other"],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700">
                {label}
              </label>
              <div className="mt-1.5 flex rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-slate-500">
                <span className="flex items-center rounded-l-lg border-r border-gray-300 bg-gray-50 px-2.5 text-sm text-gray-600">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register(name, { valueAsNumber: true })}
                  className="min-w-0 flex-1 rounded-r-lg border-0 bg-transparent py-2 pr-3 pl-1 text-sm text-gray-900 focus:ring-0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rates & markup */}
      <div className="rounded-xl bg-indigo-50 p-4">
        <h2 className="border-b border-indigo-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Rates & markup
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Labor Burden $/hr
            </label>
            <input
              type="number"
              step="1"
              min={0}
              {...register("laborBurden", { valueAsNumber: true })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Labor Billing Rate $/hr
            </label>
            <input
              type="number"
              step="1"
              min={0}
              {...register("laborBillingRate", { valueAsNumber: true })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Material Markup %
            </label>
            <input
              type="number"
              step="1"
              min={0}
              max={200}
              {...register("materialMarkup", { valueAsNumber: true })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sub Markup %
            </label>
            <input
              type="number"
              step="1"
              min={0}
              max={200}
              {...register("subMarkup", { valueAsNumber: true })}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

      {/* Live calculated totals */}
      <div className="rounded-xl bg-emerald-50 p-4">
        <h2 className="border-b border-emerald-100 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Calculated totals
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <span className="text-gray-600">Labor cost</span>
            <p className="font-medium text-gray-900">
              {formatCurrency(totals.laborCost)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Labor billing</span>
            <p className="font-medium text-gray-900">
              {formatCurrency(totals.laborBilling)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Labor marked up</span>
            <p className="font-medium text-gray-900">
              {formatCurrency(totals.laborMarkedUp)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Material marked up</span>
            <p className="font-medium text-gray-900">
              {formatCurrency(totals.materialMarkedUp)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Sub marked up</span>
            <p className="font-medium text-gray-900">
              {formatCurrency(totals.subMarkedUp)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Amount requested</span>
            <p className="font-semibold text-gray-900">
              {formatCurrency(totals.amountRequested)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Amount approved</span>
            <p className="font-semibold text-emerald-800">
              {formatCurrency(totals.amountApproved)}
            </p>
          </div>
        </div>
      </div>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? "Saving…" : "Create change order"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
