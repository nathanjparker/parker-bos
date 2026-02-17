"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export default function Home() {
  const router = useRouter();
  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      router.replace(user ? "/dashboard" : "/login");
    });
    return () => unsub();
  }, [auth, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <main className="w-full max-w-md rounded-2xl bg-white shadow-lg px-8 py-10 border border-gray-100 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
          PB
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Parker BOS</h1>
        <p className="mt-2 text-sm text-gray-600">
          {auth
            ? "Checking your session…"
            : "Firebase isn’t configured yet. Add your env vars and restart the dev server."}
        </p>
        <div className="mt-6 flex justify-center">
          {auth ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          ) : null}
        </div>
      </main>
    </div>
  );
}
