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
import { type Jurisdiction } from "@/types/jurisdictions";

type FormValues = {
  name: string;
  state: string;
  phone: string;
  inspectionPhone: string;
  address: string;
  website: string;
  notes: string;
  contactNames: string;
};

const EMPTY: FormValues = {
  name: "",
  state: "WA",
  phone: "",
  inspectionPhone: "",
  address: "",
  website: "",
  notes: "",
  contactNames: "",
};

function jurisdictionToForm(j: Jurisdiction): FormValues {
  return {
    name: j.name ?? "",
    state: j.state ?? "WA",
    phone: j.phone ?? "",
    inspectionPhone: j.inspectionPhone ?? "",
    address: j.address ?? "",
    website: j.website ?? "",
    notes: j.notes ?? "",
    contactNames: j.contactNames ?? "",
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

export default function JurisdictionForm({
  jurisdiction,
  createdBy,
}: {
  jurisdiction?: Jurisdiction;
  createdBy: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(
    jurisdiction ? jurisdictionToForm(jurisdiction) : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
    };
    if (values.state.trim()) payload.state = values.state.trim();
    if (values.phone.trim()) payload.phone = values.phone.trim();
    if (values.inspectionPhone.trim()) payload.inspectionPhone = values.inspectionPhone.trim();
    if (values.address.trim()) payload.address = values.address.trim();
    if (values.website.trim()) payload.website = values.website.trim();
    if (values.notes.trim()) payload.notes = values.notes.trim();
    if (values.contactNames.trim()) payload.contactNames = values.contactNames.trim();

    try {
      if (jurisdiction) {
        await updateDoc(doc(db, "jurisdictions", jurisdiction.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        router.push(`/jurisdictions/${jurisdiction.id}`);
      } else {
        const ref = await addDoc(collection(db, "jurisdictions"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        });
        router.push(`/jurisdictions/${ref.id}`);
      }
    } catch (err) {
      console.error("JurisdictionForm save error:", err);
      setError("Failed to save. Please try again.");
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

      {/* Main info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Jurisdiction Info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name *">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. City of Seattle"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="State">
            <input
              type="text"
              className={inputCls}
              placeholder="WA"
              value={values.state}
              onChange={(e) => set("state", e.target.value)}
              maxLength={2}
            />
          </Field>
          <Field label="Office Phone">
            <input
              type="tel"
              className={inputCls}
              placeholder="(206) 555-1234"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Inspection Request Line">
            <input
              type="tel"
              className={inputCls}
              placeholder="(206) 555-5678"
              value={values.inspectionPhone}
              onChange={(e) => set("inspectionPhone", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <input
              type="url"
              className={inputCls}
              placeholder="https://"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input
                type="text"
                className={inputCls}
                placeholder="123 Main St, Seattle, WA 98101"
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Contacts (comma-separated names)">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Jane Smith, Bob Jones"
                value={values.contactNames}
                onChange={(e) => set("contactNames", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                placeholder="Inspection process, hours, special instructions…"
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : jurisdiction ? "Save Changes" : "Create Jurisdiction"}
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
