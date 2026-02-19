"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import JurisdictionForm from "@/components/JurisdictionForm";
import { getFirebaseAuth } from "@/lib/firebase";

export default function NewJurisdictionPage() {
  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Add Jurisdiction</h1>
        </div>
        <JurisdictionForm createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
