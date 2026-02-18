"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import CompanyForm from "@/components/CompanyForm";
import { getFirebaseAuth } from "@/lib/firebase";

export default function NewCompanyPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">New Company</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add a GC, subcontractor, vendor, or owner.
          </p>
        </div>
        <CompanyForm createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
