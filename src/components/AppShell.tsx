"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Jobs", href: "/jobs" },
  { label: "Companies", href: "/companies" },
  { label: "Contacts", href: "/contacts" },
  { label: "Employees", href: "/employees" },
  { label: "Jurisdictions", href: "/jurisdictions" },
  { label: "Change Orders", href: "/change-orders" },
  { label: "Purchase Orders", href: "/pos", comingSoon: true },
  { label: "Files", href: "/files", comingSoon: true },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, [auth, router]);

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

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-gray-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold shrink-0">
          PB
        </div>
        <span className="text-sm font-semibold text-white">Parker BOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.comingSoon ? "#" : item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : item.comingSoon
                  ? "text-gray-500 cursor-default"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
              {item.comingSoon && (
                <span className="rounded-full border border-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 px-3 py-3">
        <p className="truncate text-xs text-gray-400">{user?.email}</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-2 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50 transition-colors"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-col md:shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-gray-900/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 w-56 flex flex-col">{sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Open sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900">
            Parker BOS
          </span>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
