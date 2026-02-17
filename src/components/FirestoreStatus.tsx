"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

type Status = "idle" | "connecting" | "connected" | "error" | "not-configured";

export function FirestoreStatus() {
  const configured = isFirebaseConfigured() && !!db;
  const [status, setStatus] = useState<Status>(() =>
    configured ? "connecting" : "not-configured"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!configured) return;
    getDocs(collection(db, "_connection_test"))
      .then(() => {
        setStatus("connected");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err?.message ?? "Connection failed");
      });
  }, [configured]);

  if (status === "not-configured") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Firebase not configured — add .env.local (see .env.local.example)
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500" />
        Connecting to Firestore…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Firestore error: {errorMessage}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      Firestore connected
    </div>
  );
}
