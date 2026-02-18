"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import JobForm from "@/components/JobForm";
import { getFirebaseAuth } from "@/lib/firebase";

export default function NewJobPage() {
  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);
  const userEmail = auth?.currentUser?.email ?? "";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add a new project to Parker BOS.
          </p>
        </div>
        <JobForm createdBy={userEmail} />
      </div>
    </AppShell>
  );
}
