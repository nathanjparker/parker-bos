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
import {
  COMPANY_TYPES,
  type Company,
  type CompanyType,
} from "@/types/companies";

type FormValues = {
  name: string;
  type: CompanyType;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
};

const EMPTY: FormValues = {
  name: "",
  type: "GC",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "WA",
  zip: "",
  website: "",
};

function companyToForm(c: Company): FormValues {
  return {
    name: c.name ?? "",
    type: c.type ?? "GC",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    state: c.state ?? "WA",
    zip: c.zip ?? "",
    website: c.website ?? "",
  };
}

const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

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

export default function CompanyForm({
  company,
  createdBy,
}: {
  company?: Company;
  createdBy: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(
    company ? companyToForm(company) : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Partial<Company> = {
      name: values.name.trim(),
      type: values.type,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      address: values.address.trim() || undefined,
      city: values.city.trim() || undefined,
      state: values.state.trim() || undefined,
      zip: values.zip.trim() || undefined,
      website: values.website.trim() || undefined,
    };

    try {
      if (company) {
        await updateDoc(doc(db, "companies", company.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        router.push(`/companies/${company.id}`);
      } else {
        const ref = await addDoc(collection(db, "companies"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        });
        router.push(`/companies/${ref.id}`);
      }
    } catch (err) {
      console.error("CompanyForm save error:", err);
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Company Info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Company Name *">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Dovetail Construction"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Type">
            <select
              className={inputCls}
              value={values.type}
              onChange={(e) => set("type", e.target.value as CompanyType)}
            >
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "GC"
                    ? "General Contractor"
                    : t === "Sub"
                    ? "Subcontractor"
                    : t === "Vendor"
                    ? "Vendor / Supplier"
                    : t === "Owner"
                    ? "Owner / Developer"
                    : "Other"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              className={inputCls}
              placeholder="(206) 555-0100"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              placeholder="contact@company.com"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <input
              type="text"
              className={inputCls}
              placeholder="https://..."
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Address
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Street">
              <input
                type="text"
                className={inputCls}
                placeholder="123 Main St"
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              type="text"
              className={inputCls}
              placeholder="Seattle"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
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
          <Field label="ZIP">
            <input
              type="text"
              className={inputCls}
              placeholder="98101"
              value={values.zip}
              onChange={(e) => set("zip", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : company ? "Save Changes" : "Create Company"}
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
