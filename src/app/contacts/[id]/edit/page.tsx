"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import ContactForm from "@/components/ContactForm";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { type Contact } from "@/types/companies";

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => {
    try { return getFirebaseAuth(); } catch { return null; }
  }, []);

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
        <div className="mb-6">
          <p className="text-xs text-gray-400">
            <Link href={`/contacts/${id}`} className="hover:text-blue-600">← Contact</Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit Contact</h1>
        </div>
        <ContactForm contact={contact} createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
