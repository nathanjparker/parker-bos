"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export default function FieldMorePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const auth = useMemo(() => {
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  async function handleSignOut() {
    if (!auth) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="mb-5 text-2xl font-bold text-[#F1F3F7]">More</h1>

      {/* User card */}
      <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[rgba(59,130,246,0.12)] text-lg font-bold text-[#3B82F6]">
            {user?.displayName
              ? user.displayName
                  .split(" ")
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")
                  .slice(0, 2)
              : "?"}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F1F3F7]">
              {user?.displayName ?? "Field User"}
            </div>
            <div className="text-xs text-[#8B90A0]">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] overflow-hidden">
        <a
          href="/field-schedule"
          className="flex items-center justify-between px-4 py-4 border-b border-[#2A2E3B] transition-colors hover:bg-[#222633]"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📅</span>
            <span className="text-sm font-medium text-[#F1F3F7]">My Schedule</span>
          </div>
          <svg className="h-4 w-4 text-[#585D6E]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#222633] disabled:opacity-50"
        >
          <span className="text-lg">🚪</span>
          <span className="text-sm font-medium text-[#EF4444]">
            {signingOut ? "Signing out…" : "Sign Out"}
          </span>
        </button>
      </div>

      {/* App version / info */}
      <p className="text-center text-xs text-[#585D6E]">
        Parker BOS · Field
      </p>
    </div>
  );
}
