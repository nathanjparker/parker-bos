"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import JurisdictionForm from "@/components/JurisdictionForm";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { type Jurisdiction } from "@/types/jurisdictions";

export default function EditJurisdictionPage() {
  const { id } = useParams<{ id: string }>();
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "jurisdictions", id), (snap) => {
      if (snap.exists()) {
        setJurisdiction({ id: snap.id, ...(snap.data() as Omit<Jurisdiction, "id">) });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!jurisdiction) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-500">Jurisdiction not found.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Edit Jurisdiction</h1>
          <p className="mt-1 text-sm text-gray-500">{jurisdiction.name}</p>
        </div>
        <JurisdictionForm jurisdiction={jurisdiction} createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
