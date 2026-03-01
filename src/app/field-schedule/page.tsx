"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { checkParkerAccess } from "@/lib/auth-check";
import { getAppRole } from "@/lib/getAppRole";
import FieldScheduleView from "@/components/calendar/FieldScheduleView";
import SessionCompletionModal from "@/components/calendar/SessionCompletionModal";
import type { AccessLevel } from "@/types/employees";
import type { ScheduleSession } from "@/types/scheduling";

export default function FieldSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [completionSession, setCompletionSession] = useState<ScheduleSession | null>(null);

  // Auth check
  useEffect(() => {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch {
      router.replace("/login");
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      const result = await checkParkerAccess(u);
      if (!result.ok) {
        await signOut(auth);
        router.replace(`/login?error=${result.error}`);
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  // Map auth user → employee record
  useEffect(() => {
    if (!user) return;

    async function resolveEmployee() {
      const role = await getAppRole(user!.uid);
      setIsAdmin(role === "admin");

      // Try matching by authUid first
      const byUid = query(
        collection(db, "employees"),
        where("authUid", "==", user!.uid)
      );
      const uidSnap = await getDocs(byUid);
      if (!uidSnap.empty) {
        const data = uidSnap.docs[0].data();
        setEmployeeId(uidSnap.docs[0].id);
        setAccessLevel((data.accessLevel as AccessLevel) ?? "office");
        setLoading(false);
        return;
      }

      // Fall back to matching by email
      if (user!.email) {
        const byEmail = query(
          collection(db, "employees"),
          where("email", "==", user!.email)
        );
        const emailSnap = await getDocs(byEmail);
        if (!emailSnap.empty) {
          const data = emailSnap.docs[0].data();
          setEmployeeId(emailSnap.docs[0].id);
          setAccessLevel((data.accessLevel as AccessLevel) ?? "office");
          setLoading(false);
          return;
        }
      }

      // No employee record found
      setEmployeeId(null);
      setLoading(false);
    }

    resolveEmployee();
  }, [user]);

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
