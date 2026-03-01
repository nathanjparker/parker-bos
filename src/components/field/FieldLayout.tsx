"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { checkParkerAccess } from "@/lib/auth-check";
import { getAppRole } from "@/lib/getAppRole";
import { FieldProvider } from "@/lib/fieldContext";
import BottomNav from "@/components/field/BottomNav";
import FAB from "@/components/field/FAB";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auth) {
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
      // Redirect pure office users to the office dashboard
      const role = await getAppRole(u.uid);
      if (role === "office") {
        router.replace("/dashboard");
        return;
      }
      setChecking(false);
    });
    return () => unsub();
  }, [auth, router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1117]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
      </div>
    );
  }

  return (
    <FieldProvider>
      {/* Dark background, pad bottom for fixed nav bar */}
      <div className="min-h-screen bg-[#0F1117]" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <main className="mx-auto max-w-lg">
          {children}
        </main>
      </div>
      <BottomNav />
      <FAB />
    </FieldProvider>
  );
}
