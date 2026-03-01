"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { FieldProvider } from "@/lib/fieldContext";
import BottomNav from "@/components/field/BottomNav";
import FAB from "@/components/field/FAB";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { appUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
    // Pure office users belong in the office dashboard, not the field interface
    if (appUser.appRole === "office") {
      router.replace("/dashboard");
    }
  }, [loading, appUser, router]);

  if (loading || !appUser || appUser.appRole === "office") {
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
