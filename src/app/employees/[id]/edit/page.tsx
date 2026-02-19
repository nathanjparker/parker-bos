"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import EmployeeForm from "@/components/EmployeeForm";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { type Employee } from "@/types/employees";

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => {
    try { return getFirebaseAuth(); } catch { return null; }
  }, []);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "employees", id), (snap) => {
      setEmployee(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Employee, "id">) } : null);
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

  if (!employee) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">Employee not found.</p>
          <Link href="/employees" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Employees
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
            <Link href={`/employees/${id}`} className="hover:text-blue-600">← Employee</Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit Employee</h1>
        </div>
        <EmployeeForm employee={employee} createdBy={auth?.currentUser?.email ?? ""} />
      </div>
    </AppShell>
  );
}
