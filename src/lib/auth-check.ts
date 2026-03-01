"use client";

import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AuthError = "unauthorized" | "no-access" | "inactive";

type AuthCheckResult =
  | { ok: true }
  | { ok: false; error: AuthError };

export const AUTH_ERROR_MESSAGES: Record<AuthError, string> = {
  unauthorized: "Access is restricted to Parker Services employees.",
  "no-access":
    "Your account hasn\u2019t been set up yet. Contact Nate for access.",
  inactive: "Your account has been deactivated. Contact Nate.",
};

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

/**
 * Validate that a Firebase user belongs to @parkerservices.co,
 * has a users/{uid} doc, and isActive is true.
 * On localhost, the @parkerservices.co requirement is skipped so you can sign in with any Google account for development.
 */
export async function checkParkerAccess(user: User): Promise<AuthCheckResult> {
  if (!isLocalhost() && !user.email?.endsWith("@parkerservices.co")) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      if (isLocalhost()) return { ok: true }; // Allow on localhost without a user doc for development
      return { ok: false, error: "no-access" };
    }
    if (snap.data()?.isActive === false) {
      return { ok: false, error: "inactive" };
    }
  } catch {
    if (isLocalhost()) return { ok: true };
    return { ok: false, error: "no-access" };
  }

  return { ok: true };
}
