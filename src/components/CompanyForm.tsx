"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteField,
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
  const [tags, setTags] = useState<string[]>(company?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags((t) => [...t, tag]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((t) => t.slice(0, -1));
    }
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
      tags: tags.length > 0 ? tags : undefined,
    };

    try {
      if (company) {
        // updateDoc doesn't accept undefined — replace with deleteField() to clear removed values
        const updatePayload = Object.fromEntries(
          Object.entries({ ...payload, updatedAt: serverTimestamp() }).map(
            ([k, v]) => [k, v === undefined ? deleteField() : v]
          )
        );
        await updateDoc(doc(db, "companies", company.id), updatePayload);
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
                    ? "Vendor"
                    : t === "Owner"
                    ? "Business"
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

      {/* Tags */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Tags</h2>
        <p className="mb-3 text-xs text-gray-400">Add specialty labels like "backflow tester", "hvac", "fire sprinkler". Press Enter or comma to add.</p>
        <div
          className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-text"
          onClick={() => tagInputRef.current?.focus()}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setTags((t) => t.filter((x) => x !== tag)); }}
                className="ml-0.5 text-violet-400 hover:text-violet-700"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder={tags.length === 0 ? "e.g. backflow tester, hvac…" : ""}
            className="min-w-[140px] flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
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
