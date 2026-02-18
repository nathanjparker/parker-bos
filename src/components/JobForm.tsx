"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PROJECT_PHASES, type Job, type ProjectPhase } from "@/types/jobs";

type FormValues = {
  jobName: string;
  projectPhase: ProjectPhase;
  gcName: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
  estimatorName: string;
  pmName: string;
  superintendentName: string;
  originalContractValue: string;
};

const EMPTY: FormValues = {
  jobName: "",
  projectPhase: "Lead",
  gcName: "",
  siteAddress: "",
  siteCity: "",
  siteState: "WA",
  siteZip: "",
  estimatorName: "",
  pmName: "",
  superintendentName: "",
  originalContractValue: "",
};

function jobToForm(job: Job): FormValues {
  return {
    jobName: job.jobName ?? "",
    projectPhase: job.projectPhase ?? "Lead",
    gcName: job.gcName ?? "",
    siteAddress: job.siteAddress ?? "",
    siteCity: job.siteCity ?? "",
    siteState: job.siteState ?? "WA",
    siteZip: job.siteZip ?? "",
    estimatorName: job.estimatorName ?? "",
    pmName: job.pmName ?? "",
    superintendentName: job.superintendentName ?? "",
    originalContractValue: job.originalContractValue
      ? String(job.originalContractValue)
      : "",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function JobForm({
  job,
  createdBy,
}: {
  job?: Job;
  createdBy: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(
    job ? jobToForm(job) : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.jobName.trim()) {
      setError("Job name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Partial<Job> = {
      jobName: values.jobName.trim(),
      projectPhase: values.projectPhase,
      gcName: values.gcName.trim() || undefined,
      siteAddress: values.siteAddress.trim() || undefined,
      siteCity: values.siteCity.trim() || undefined,
      siteState: values.siteState.trim() || undefined,
      siteZip: values.siteZip.trim() || undefined,
      estimatorName: values.estimatorName.trim() || undefined,
      pmName: values.pmName.trim() || undefined,
      superintendentName: values.superintendentName.trim() || undefined,
      originalContractValue: values.originalContractValue
        ? Number(values.originalContractValue.replace(/[^0-9.]/g, ""))
        : undefined,
    };

    try {
      if (job) {
        await updateDoc(doc(db, "Jobs", job.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        router.push(`/jobs/${job.id}`);
      } else {
        const ref = await addDoc(collection(db, "Jobs"), {
          ...payload,
          currentContractValue: payload.originalContractValue ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        });
        router.push(`/jobs/${ref.id}`);
      }
    } catch (err) {
      console.error("JobForm save error:", err);
      setError("Failed to save job. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Core */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Job Info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Job Name *">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Circle Wellness"
                value={values.jobName}
                onChange={(e) => set("jobName", e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Phase">
            <select
              className={inputCls}
              value={values.projectPhase}
              onChange={(e) =>
                set("projectPhase", e.target.value as ProjectPhase)
              }
            >
              {PROJECT_PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="General Contractor">
            <input
              type="text"
              className={inputCls}
              placeholder="GC company name"
              value={values.gcName}
              onChange={(e) => set("gcName", e.target.value)}
            />
          </Field>
          <Field label="Original Contract Value">
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. 315000"
              value={values.originalContractValue}
              onChange={(e) => set("originalContractValue", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Site */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Site Address
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Street">
              <input
                type="text"
                className={inputCls}
                placeholder="123 Main St"
                value={values.siteAddress}
                onChange={(e) => set("siteAddress", e.target.value)}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              type="text"
              className={inputCls}
              placeholder="Seattle"
              value={values.siteCity}
              onChange={(e) => set("siteCity", e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              type="text"
              className={inputCls}
              placeholder="WA"
              value={values.siteState}
              onChange={(e) => set("siteState", e.target.value)}
              maxLength={2}
            />
          </Field>
          <Field label="ZIP">
            <input
              type="text"
              className={inputCls}
              placeholder="98101"
              value={values.siteZip}
              onChange={(e) => set("siteZip", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Team */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Team
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Estimator">
            <input
              type="text"
              className={inputCls}
              placeholder="Name"
              value={values.estimatorName}
              onChange={(e) => set("estimatorName", e.target.value)}
            />
          </Field>
          <Field label="Project Manager">
            <input
              type="text"
              className={inputCls}
              placeholder="Name"
              value={values.pmName}
              onChange={(e) => set("pmName", e.target.value)}
            />
          </Field>
          <Field label="Superintendent">
            <input
              type="text"
              className={inputCls}
              placeholder="Name"
              value={values.superintendentName}
              onChange={(e) => set("superintendentName", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : job ? "Save Changes" : "Create Job"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
