"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { checkParkerAccess, type AuthError } from "@/lib/auth-check";
import { getAppRole, type AppRole } from "@/lib/getAppRole";

export interface AppUser {
  firebaseUser: User;
  appRole: AppRole | null;
}

interface AuthContextValue {
  appUser: AppUser | null;
  loading: boolean;
  authError: AuthError | null;
}

const AuthContext = createContext<AuthContextValue>({
  appUser: null,
  loading: true,
  authError: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      // Re-enter loading while we validate — prevents stale UI between sign-ins
      setLoading(true);

      const result = await checkParkerAccess(user);
      if (!result.ok) {
        setAuthError(result.error);
        setAppUser(null);
        setLoading(false);
        // signOut triggers onAuthStateChanged(null) which is a no-op at this point
        await signOut(auth);
        return;
      }

      const role = await getAppRole(user.uid);
      setAuthError(null);
      setAppUser({ firebaseUser: user, appRole: role });
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ appUser, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
