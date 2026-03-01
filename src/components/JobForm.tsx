"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PROJECT_PHASES, type Job, type ProjectPhase } from "@/types/jobs";
import { type Company } from "@/types/companies";
import { type Jurisdiction } from "@/types/jurisdictions";
import ContactPicker from "@/components/ContactPicker";

type TeamField = {
  id: string;
  name: string;
  phone?: string;
};

const PHASES_WITH_BID_DUE: ProjectPhase[] = ["Lead", "Bidding"];
const PHASES_WITH_PARCEL: ProjectPhase[] = ["Awarded", "Active", "Install", "Warranty", "Closed"];

type FormValues = {
  jobName: string;
  projectPhase: ProjectPhase;
  gcId: string;
  gcName: string;
  jurisdictionId: string;
  jurisdictionName: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
  originalContractValue: string;
  parcelNumber: string;
  bidDueDate: string;
  estimator: TeamField;
  pm: TeamField;
  superintendent: TeamField;
};

const EMPTY_TEAM: TeamField = { id: "", name: "" };

const EMPTY: FormValues = {
  jobName: "",
  projectPhase: "Lead",
  gcId: "",
  gcName: "",
  jurisdictionId: "",
  jurisdictionName: "",
  siteAddress: "",
  siteCity: "",
  siteState: "WA",
  siteZip: "",
  originalContractValue: "",
  parcelNumber: "",
  bidDueDate: "",
  estimator: EMPTY_TEAM,
  pm: EMPTY_TEAM,
  superintendent: EMPTY_TEAM,
};

function jobToForm(job: Job): FormValues {
  return {
    jobName: job.jobName ?? "",
    projectPhase: job.projectPhase ?? "Lead",
    gcId: job.gcId ?? "",
    gcName: job.gcName ?? "",
    jurisdictionId: job.jurisdictionId ?? "",
    jurisdictionName: job.jurisdictionName ?? "",
    siteAddress: job.siteAddress ?? "",
    siteCity: job.siteCity ?? "",
    siteState: job.siteState ?? "WA",
    siteZip: job.siteZip ?? "",
    originalContractValue: job.originalContractValue
      ? String(job.originalContractValue)
      : "",
    parcelNumber: job.parcelNumber ?? "",
    bidDueDate: job.bidDueDate
      ? (job.bidDueDate as Timestamp).toDate().toISOString().slice(0, 10)
      : "",
    estimator: { id: job.estimatorId ?? "", name: job.estimatorName ?? "", phone: job.estimatorPhone },
    pm: { id: job.pmId ?? "", name: job.pmName ?? "", phone: job.projectManagerPhone },
    superintendent: {
      id: job.superintendentId ?? "",
      name: job.superintendentName ?? "",
      phone: job.superintendentPhone,
    },
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
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
  const [values, setValues] = useState<FormValues>(job ? jobToForm(job) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);

  useEffect(() => {
    const q = query(collection(db, "companies"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setCompanies(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, "id">) }))
      );
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "jurisdictions"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setJurisdictions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Jurisdiction, "id">) }))
      );
    });
  }, []);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function setTeam(field: "estimator" | "pm" | "superintendent", id: string, name: string, phone?: string) {
    setValues((v) => ({ ...v, [field]: { id, name, phone } }));
  }

  function handleGcChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const gcId = e.target.value;
    const company = companies.find((c) => c.id === gcId);
    setValues((v) => ({
      ...v,
      gcId,
      gcName: company?.name ?? "",
    }));
  }

  function handleJurisdictionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const jurisdictionId = e.target.value;
    const jurisdiction = jurisdictions.find((j) => j.id === jurisdictionId);
    setValues((v) => ({
      ...v,
      jurisdictionId,
      jurisdictionName: jurisdiction?.name ?? "",
    }));
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
      gcId: values.gcId || undefined,
      gcName: values.gcName || undefined,
      jurisdictionId: values.jurisdictionId || undefined,
      jurisdictionName: values.jurisdictionName || undefined,
      siteAddress: values.siteAddress.trim() || undefined,
      siteCity: values.siteCity.trim() || undefined,
      siteState: values.siteState.trim() || undefined,
      siteZip: values.siteZip.trim() || undefined,
      originalContractValue: values.originalContractValue
        ? Number(values.originalContractValue.replace(/[^0-9.]/g, ""))
        : undefined,
      parcelNumber: values.parcelNumber.trim() || undefined,
      bidDueDate: values.bidDueDate.trim()
        ? Timestamp.fromDate(new Date(values.bidDueDate))
        : undefined,
      estimatorId: values.estimator.id || undefined,
      estimatorName: values.estimator.name || undefined,
      estimatorPhone: values.estimator.phone || undefined,
      pmId: values.pm.id || undefined,
      pmName: values.pm.name || undefined,
      projectManagerPhone: values.pm.phone || undefined,
      superintendentId: values.superintendent.id || undefined,
      superintendentName: values.superintendent.name || undefined,
      superintendentPhone: values.superintendent.phone || undefined,
    };

    try {
      if (job) {
        const updateData = {
          ...payload,
          updatedAt: serverTimestamp(),
        };
        const clean = Object.fromEntries(
          Object.entries(updateData).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        await updateDoc(doc(db, "Jobs", job.id), clean);
        router.push(`/jobs/${job.id}`);
      } else {
        const docData = {
          ...payload,
          currentContractValue: payload.originalContractValue ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        };
        const clean = Object.fromEntries(
          Object.entries(docData).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        const ref = await addDoc(collection(db, "Jobs"), clean);
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
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
              onChange={(e) => set("projectPhase", e.target.value as ProjectPhase)}
            >
              {PROJECT_PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="General Contractor">
            <select className={inputCls} value={values.gcId} onChange={handleGcChange}>
              <option value="">Select a GC</option>
              {companies
                .filter((c) => c.type === "GC")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              {companies.filter((c) => c.type !== "GC").length > 0 && (
                <optgroup label="Other Companies">
                  {companies
                    .filter((c) => c.type !== "GC")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </Field>
          <Field label="Jurisdiction">
            <select className={inputCls} value={values.jurisdictionId} onChange={handleJurisdictionChange}>
              <option value="">Select jurisdiction</option>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </Field>
          {PHASES_WITH_BID_DUE.includes(values.projectPhase) && (
            <Field label="Bid Due Date">
              <input
                type="date"
                className={inputCls}
                value={values.bidDueDate}
                onChange={(e) => set("bidDueDate", e.target.value)}
              />
            </Field>
          )}
          {PHASES_WITH_PARCEL.includes(values.projectPhase) && (
            <Field label="Parcel #">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 123456-001"
                value={values.parcelNumber}
                onChange={(e) => set("parcelNumber", e.target.value)}
              />
            </Field>
          )}
        </div>
      </div>

      {/* Site */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Team
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Select from your contacts directory.{" "}
          <a href="/companies" target="_blank" className="text-blue-600 hover:underline">
            Manage contacts →
          </a>
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ContactPicker
            label="Estimator"
            value={values.estimator.id}
            onChange={(id, name, phone) => setTeam("estimator", id, name, phone)}
            placeholder="Select estimator"
          />
          <ContactPicker
            label="Project Manager"
            value={values.pm.id}
            onChange={(id, name, phone) => setTeam("pm", id, name, phone)}
            placeholder="Select PM"
          />
          <ContactPicker
            label="Superintendent"
            value={values.superintendent.id}
            onChange={(id, name, phone) => setTeam("superintendent", id, name, phone)}
            placeholder="Select super"
          />
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
