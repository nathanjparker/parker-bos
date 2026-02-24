"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { formatPhoneDisplay, formatPhoneTel } from "@/lib/format";
import { contactDisplayName, type Contact } from "@/types/companies";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "contacts", id), (snap) => {
      setContact(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Contact, "id">) } : null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!contact) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">Contact not found.</p>
          <Link href="/contacts" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Contacts
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <p className="text-xs text-gray-400">
          <Link href="/contacts" className="hover:text-blue-600">← Contacts</Link>
        </p>

        {/* Header */}
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contactDisplayName(contact)}</h1>
            {contact.title && <p className="mt-0.5 text-sm text-gray-500">{contact.title}</p>}
          </div>
          <Link
            href={`/contacts/${id}/edit`}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 shrink-0"
          >
            Edit
          </Link>
        </div>

        {/* Detail card */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            {contact.companyName && (
              <InfoRow label="Company">
                {contact.companyId ? (
                  <Link href={`/companies/${contact.companyId}`} className="text-blue-600 hover:underline">
                    {contact.companyName}
                  </Link>
                ) : (
                  contact.companyName
                )}
              </InfoRow>
            )}
            {contact.phone && (
              <InfoRow label="Phone">
                <a href={`tel:${formatPhoneTel(contact.phone)}`} className="text-blue-600 hover:underline">
                  {formatPhoneDisplay(contact.phone)}
                </a>
              </InfoRow>
            )}
            {contact.email && (
              <InfoRow label="Email">
                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                  {contact.email}
                </a>
              </InfoRow>
            )}
            {!contact.companyName && !contact.phone && !contact.email && (
              <p className="col-span-2 text-sm text-gray-400">No additional details.</p>
            )}
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
