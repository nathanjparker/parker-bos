"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatPhoneDisplay, formatPhoneTel } from "@/lib/format";
import { contactDisplayName, type Contact } from "@/types/companies";

type Props = {
  contactId: string | null;
  onClose: () => void;
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default function ContactDetailModal({ contactId, onClose }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(!!contactId);

  useEffect(() => {
    if (!contactId) {
      setContact(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, "contacts", contactId), (snap) => {
      setContact(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Contact, "id">) } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [contactId]);

  if (!contactId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
      />
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="contact-modal-title" className="text-lg font-semibold text-gray-900">
            Contact
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            </div>
          ) : !contact ? (
            <p className="py-4 text-sm text-gray-500">Contact not found.</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-base font-semibold text-gray-900">{contactDisplayName(contact)}</p>
                {contact.title && <p className="text-sm text-gray-500">{contact.title}</p>}
              </div>
              <dl className="space-y-3">
                {contact.companyName && (
                  <InfoRow label="Company">{contact.companyName}</InfoRow>
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
                  <p className="text-sm text-gray-400">No additional details.</p>
                )}
              </dl>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          {contact && (
            <Link
              href={`/contacts/${contactId}/edit`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Edit contact
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
