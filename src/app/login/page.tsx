"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  type AuthError,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { checkParkerAccess, AUTH_ERROR_MESSAGES, type AuthError as AuthCheckError } from "@/lib/auth-check";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSigningIn, setEmailSigningIn] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = searchParams.get("error") as AuthCheckError | null;
  const accessError = urlError && AUTH_ERROR_MESSAGES[urlError] ? AUTH_ERROR_MESSAGES[urlError] : null;

  // Handle return from Google redirect sign-in. Must run once and not be skipped by
  // React Strict Mode cleanup, or we never navigate and the user stays on login.
  useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) {
          if (!cancelled) setChecking(false);
          return;
        }
        if (!cancelled) setGoogleSigningIn(true);
        const ok = await validateAndRedirect(result.user);
        if (!cancelled) {
          setGoogleSigningIn(false);
          setChecking(false);
        }
        // Always navigate on success so we don't get stuck when effect cleanup runs (e.g. Strict Mode).
        if (ok) router.replace("/dashboard");
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        const e = err as Partial<AuthError> | undefined;
        if (e?.code === "auth/credential-already-in-use") {
          setError("This Google account is already linked to another sign-in method.");
        } else if (e?.code) {
          setError(`Google sign-in failed (${e.code}). Try again or use email/password instead.`);
        } else {
          setError("Google sign-in failed. Try again or use email/password instead.");
        }
        setGoogleSigningIn(false);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }
      const result = await checkParkerAccess(user);
      if (!result.ok) {
        await signOut(auth);
        setChecking(false);
        return;
      }
      router.replace("/dashboard");
    });

    return () => unsub();
  }, [router]);

  async function validateAndRedirect(user: import("firebase/auth").User): Promise<boolean> {
    const result = await checkParkerAccess(user);
    if (!result.ok) {
      await signOut(auth);
      setError(AUTH_ERROR_MESSAGES[result.error]);
      return false;
    }
    return true;
  }

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (await validateAndRedirect(cred.user)) {
        router.replace("/dashboard");
      }
    } catch (err) {
      const e = err as Partial<AuthError> | undefined;
      switch (e?.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("Invalid email or password. This page is for existing admin accounts only.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Try again later or use a different account.");
          break;
        default:
          setError("Email sign-in failed. Check your credentials and try again.");
      }
    } finally {
      setEmailSigningIn(false);
    }
  }

  function handleGoogleSignIn() {
    setError(null);
    setGoogleSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    signInWithRedirect(auth, provider);
    // Page will navigate away to Google; getRedirectResult handles the return.
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <main className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-gray-100 px-8 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-lg">
            PB
          </div>
          <p className="text-xs font-semibold tracking-[0.25em] text-blue-600 uppercase">
            Parker Services
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Parker BOS</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the dashboard.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {accessError && !error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {accessError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={checking || googleSigningIn}
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="h-5 w-5"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.1 1.53 7.5 2.8l5.5-5.5C33.77 3.65 29.3 1.5 24 1.5 14.8 1.5 6.91 6.97 3.26 14.92l6.77 5.26C11.7 13.55 17.3 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.5 24.5c0-1.57-.14-2.77-.44-4.02H24v7.6h12.9c-.26 2.05-1.66 5.14-4.77 7.22l7.3 5.64c4.26-3.93 6.77-9.72 6.77-16.44z"
              />
              <path
                fill="#FBBC05"
                d="M10.03 28.18c-.44-1.3-.7-2.7-.7-4.18s.26-2.88.68-4.18l-6.77-5.26C1.94 17.08 1.5 20.47 1.5 24s.44 6.92 1.74 9.62l6.79-5.44z"
              />
              <path
                fill="#34A853"
                d="M24 46.5c5.3 0 9.77-1.75 13.03-4.76l-7.3-5.64c-1.95 1.37-4.58 2.33-5.73 2.33-6.69 0-12.3-4.05-13.97-9.68l-6.79 5.44C6.91 41.03 14.8 46.5 24 46.5z"
              />
              <path fill="none" d="M1.5 1.5h45v45h-45z" />
            </svg>
            {googleSigningIn ? "Signing in with Google…" : "Continue with Google"}
          </button>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>Or sign in with email</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={checking || emailSigningIn}
              className="mt-2 w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {emailSigningIn ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-[11px] text-gray-400">
            This login is for existing Parker BOS admin accounts only. New accounts are created in
            Firebase Console.
          </p>
        </div>
      </main>
    </div>
  );
}

