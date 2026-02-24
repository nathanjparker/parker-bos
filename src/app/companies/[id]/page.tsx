"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { formatPhoneDisplay, formatPhoneTel } from "@/lib/format";
import {
  COMPANY_TYPE_BADGE,
  COMPANY_TYPE_LABEL,
  contactDisplayName,
  type Company,
  type Contact,
} from "@/types/companies";

type ContactFormValues = {
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  email: string;
};

const CONTACT_EMPTY: ContactFormValues = {
  firstName: "",
  lastName: "",
  title: "",
  phone: "",
  email: "",
};

const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactValues, setContactValues] = useState<ContactFormValues>(CONTACT_EMPTY);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ContactFormValues>(CONTACT_EMPTY);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "companies", id), (snap) => {
      if (snap.exists()) {
        setCompany({ id: snap.id, ...(snap.data() as Omit<Company, "id">) });
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "contacts"),
      where("companyId", "==", id),
      orderBy("lastName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setContacts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }))
      );
    });
  }, [id]);

  function setContact(field: keyof ContactFormValues, value: string) {
    setContactValues((v) => ({ ...v, [field]: value }));
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactValues.firstName.trim() && !contactValues.lastName.trim()) {
      setContactError("First or last name is required.");
      return;
    }
    if (!company || !id) return;
    setSavingContact(true);
    setContactError(null);

    try {
      const userEmail = auth?.currentUser?.email ?? "";
      await addDoc(collection(db, "contacts"), {
        firstName: contactValues.firstName.trim(),
        lastName: contactValues.lastName.trim(),
        companyId: id,
        companyName: company.name,
        title: contactValues.title.trim() || undefined,
        phone: contactValues.phone.trim() || undefined,
        email: contactValues.email.trim() || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userEmail,
      });
      setContactValues(CONTACT_EMPTY);
      setShowContactForm(false);
    } catch (err) {
      console.error("Add contact error:", err);
      setContactError("Failed to save contact.");
    } finally {
      setSavingContact(false);
    }
  }

  function startEditContact(c: Contact) {
    setEditingContactId(c.id);
    setEditValues({
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
      title: c.title ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    });
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent, contactId: string) {
    e.preventDefault();
    if (!editValues.firstName.trim() && !editValues.lastName.trim()) {
      setEditError("First or last name is required.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateDoc(doc(db, "contacts", contactId), {
        firstName: editValues.firstName.trim(),
        lastName: editValues.lastName.trim(),
        title: editValues.title.trim() || deleteField(),
        phone: editValues.phone.trim() || deleteField(),
        email: editValues.email.trim() || deleteField(),
        updatedAt: serverTimestamp(),
      });
      setEditingContactId(null);
    } catch (err) {
      console.error("Edit contact error:", err);
      setEditError("Failed to save. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-500">Company not found.</p>
          <Link href="/companies" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
            Back to Companies
          </Link>
        </div>
      </AppShell>
    );
  }

  const fullAddress = [company.address, company.city, company.state, company.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/companies" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
              ← Companies
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{company.name}</h1>
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  COMPANY_TYPE_BADGE[company.type]
                }`}
              >
                {COMPANY_TYPE_LABEL[company.type]}
              </span>
            </div>
          </div>
          <Link
            href={`/companies/${id}/edit`}
            className="self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Edit
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Company details */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Details
              </h2>
              <dl className="space-y-3 text-sm">
                {company.phone && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</dt>
                    <dd className="mt-0.5">
                      <a href={`tel:${formatPhoneTel(company.phone)}`} className="text-blue-600 hover:underline">
                        {formatPhoneDisplay(company.phone)}
                      </a>
                    </dd>
                  </div>
                )}
                {company.email && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</dt>
                    <dd className="mt-0.5">
                      <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">
                        {company.email}
                      </a>
                    </dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Website</dt>
                    <dd className="mt-0.5">
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                )}
                {fullAddress && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Address</dt>
                    <dd className="mt-0.5 text-gray-700">{fullAddress}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Contacts */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Contacts ({contacts.length})
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowContactForm((v) => !v);
                    setContactError(null);
                    setContactValues(CONTACT_EMPTY);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  + Add Contact
                </button>
              </div>

              {/* Inline add contact form */}
              {showContactForm && (
                <form
                  onSubmit={handleAddContact}
                  className="border-b border-gray-100 bg-blue-50/40 px-5 py-4"
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    New Contact
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="First name"
                        value={contactValues.firstName}
                        onChange={(e) => setContact("firstName", e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Last name"
                        value={contactValues.lastName}
                        onChange={(e) => setContact("lastName", e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Title (e.g. Project Manager)"
                        value={contactValues.title}
                        onChange={(e) => setContact("title", e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        className={inputCls}
                        placeholder="Phone"
                        value={contactValues.phone}
                        onChange={(e) => setContact("phone", e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="email"
                        className={inputCls}
                        placeholder="Email"
                        value={contactValues.email}
                        onChange={(e) => setContact("email", e.target.value)}
                      />
                    </div>
                  </div>
                  {contactError && (
                    <p className="mt-2 text-xs text-red-600">{contactError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={savingContact}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingContact ? "Saving…" : "Save Contact"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContactForm(false)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Contact list */}
              {contacts.length === 0 && !showContactForm ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No contacts yet. Add one above.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      {editingContactId === c.id ? (
                        /* Inline edit form */
                        <form
                          onSubmit={(e) => handleSaveEdit(e, c.id)}
                          className="bg-amber-50/40 px-5 py-4"
                        >
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Editing {contactDisplayName(c)}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="text"
                              className={inputCls}
                              placeholder="First name"
                              value={editValues.firstName}
                              onChange={(e) => setEditValues((v) => ({ ...v, firstName: e.target.value }))}
                            />
                            <input
                              type="text"
                              className={inputCls}
                              placeholder="Last name"
                              value={editValues.lastName}
                              onChange={(e) => setEditValues((v) => ({ ...v, lastName: e.target.value }))}
                            />
                            <input
                              type="text"
                              className={inputCls}
                              placeholder="Title"
                              value={editValues.title}
                              onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))}
                            />
                            <input
                              type="tel"
                              className={inputCls}
                              placeholder="Phone"
                              value={editValues.phone}
                              onChange={(e) => setEditValues((v) => ({ ...v, phone: e.target.value }))}
                            />
                            <div className="sm:col-span-2">
                              <input
                                type="email"
                                className={inputCls}
                                placeholder="Email"
                                value={editValues.email}
                                onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))}
                              />
                            </div>
                          </div>
                          {editError && <p className="mt-2 text-xs text-red-600">{editError}</p>}
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingContactId(null)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <Link
                              href={`/contacts/${c.id}`}
                              className="ml-auto text-xs text-gray-400 hover:text-blue-600"
                            >
                              Full profile →
                            </Link>
                          </div>
                        </form>
                      ) : (
                        /* Normal row */
                        <div className="flex items-center gap-4 px-5 py-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 uppercase">
                            {c.firstName?.[0] ?? ""}{c.lastName?.[0] ?? ""}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/contacts/${c.id}`}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                            >
                              {contactDisplayName(c)}
                            </Link>
                            {c.title && (
                              <p className="text-xs text-gray-500">{c.title}</p>
                            )}
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              {c.phone && (
                                <a href={`tel:${formatPhoneTel(c.phone)}`} className="text-xs text-blue-600 hover:underline">
                                  {formatPhoneDisplay(c.phone)}
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline">
                                  {c.email}
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditContact(c)}
                            className="shrink-0 text-xs font-semibold text-gray-400 hover:text-gray-700"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
