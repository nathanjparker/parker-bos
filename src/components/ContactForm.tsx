"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Contact } from "@/types/companies";
import CompanyPicker from "@/components/CompanyPicker";

type FormValues = {
  firstName: string;
  lastName: string;
  companyId: string;
  companyName: string;
  title: string;
  phone: string;
  email: string;
};

const EMPTY: FormValues = {
  firstName: "",
  lastName: "",
  companyId: "",
  companyName: "",
  title: "",
  phone: "",
  email: "",
};

function contactToForm(c: Contact): FormValues {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    companyId: c.companyId ?? "",
    companyName: c.companyName ?? "",
    title: c.title ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
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

export default function ContactForm({
  contact,
  createdBy,
}: {
  contact?: Contact;
  createdBy: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(contact ? contactToForm(contact) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!values.lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Partial<Contact> = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      companyId: values.companyId || undefined,
      companyName: values.companyName || undefined,
      title: values.title.trim() || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
    };

    try {
      if (contact) {
        const updateData = { ...payload, updatedAt: serverTimestamp() };
        const clean = Object.fromEntries(
          Object.entries(updateData).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        await updateDoc(doc(db, "contacts", contact.id), clean);
        router.push(`/contacts/${contact.id}`);
      } else {
        const docData = {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        };
        const clean = Object.fromEntries(
          Object.entries(docData).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        const ref = await addDoc(collection(db, "contacts"), clean);
        router.push(`/contacts/${ref.id}`);
      }
    } catch (err) {
      console.error("ContactForm save error:", err);
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
          Contact Info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name *">
            <input
              type="text"
              className={inputCls}
              placeholder="Jane"
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
            />
          </Field>
          <Field label="Last Name *">
            <input
              type="text"
              className={inputCls}
              placeholder="Smith"
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <CompanyPicker
              label="Company"
              value={values.companyId}
              onChange={(id, name) => setValues((v) => ({ ...v, companyId: id, companyName: name }))}
              placeholder="No company"
            />
          </div>
          <Field label="Title / Role">
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Project Manager"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
            />
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
              placeholder="jane@company.com"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
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
          {saving ? "Saving…" : contact ? "Save Changes" : "Create Contact"}
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
