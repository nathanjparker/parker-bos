"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import FieldScheduleView from "@/components/calendar/FieldScheduleView";
import SessionCompletionModal from "@/components/calendar/SessionCompletionModal";
import type { AccessLevel } from "@/types/employees";
import type { ScheduleSession } from "@/types/scheduling";

export default function FieldSchedulePage() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [completionSession, setCompletionSession] = useState<ScheduleSession | null>(null);

  const isAdmin = appUser?.appRole === "admin";

  // Redirect to login when not authenticated (after auth resolves)
  useEffect(() => {
    if (!authLoading && !appUser) {
      router.replace("/login");
    }
  }, [authLoading, appUser, router]);

  // Map auth user → employee record
  useEffect(() => {
    if (!appUser) return;

    setEmployeeLoading(true);

    async function resolveEmployee() {
      const user = appUser!.firebaseUser;

      // Try matching by authUid first
      const byUid = query(
        collection(db, "employees"),
        where("authUid", "==", user.uid)
      );
      const uidSnap = await getDocs(byUid);
      if (!uidSnap.empty) {
        const data = uidSnap.docs[0].data();
        setEmployeeId(uidSnap.docs[0].id);
        setAccessLevel((data.accessLevel as AccessLevel) ?? "office");
        setEmployeeLoading(false);
        return;
      }

      // Fall back to matching by email
      if (user.email) {
        const byEmail = query(
          collection(db, "employees"),
          where("email", "==", user.email)
        );
        const emailSnap = await getDocs(byEmail);
        if (!emailSnap.empty) {
          const data = emailSnap.docs[0].data();
          setEmployeeId(emailSnap.docs[0].id);
          setAccessLevel((data.accessLevel as AccessLevel) ?? "office");
          setEmployeeLoading(false);
          return;
        }
      }

      // No employee record found
      setEmployeeId(null);
      setEmployeeLoading(false);
    }

    resolveEmployee();
  }, [appUser]);

  const loading = authLoading || employeeLoading;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 text-center">
          <h1 className="text-lg font-bold text-gray-900">Field Schedule</h1>
          <p className="mt-4 text-sm text-gray-500">
            No employee record linked to your account. Contact your project manager.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (accessLevel === "office" && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 text-center">
          <h1 className="text-lg font-bold text-gray-900">Field Schedule</h1>
          <p className="mt-4 text-sm text-gray-500">
            Field schedule is available for field team members.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-8">
        <FieldScheduleView
          employeeId={employeeId}
          onCompleteSession={(session) => setCompletionSession(session)}
        />
      </div>

      {completionSession && (
        <SessionCompletionModal
          session={completionSession}
          onClose={() => setCompletionSession(null)}
          onComplete={() => setCompletionSession(null)}
        />
      )}
    </div>
  );
}
