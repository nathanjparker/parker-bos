"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import EmployeeForm from "@/components/EmployeeForm";
import { getFirebaseAuth } from "@/lib/firebase";

export default function NewEmployeePage() {
  const auth = useMemo(() => {
    try { return getFirebaseAuth(); } catch { return null; }
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs text-gray-400">
            <a href="/employees" className="hover:text-blue-600">← Employees</a>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">New Employee</h1>
        </div>
        <EmployeeForm createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
