"use client";

import { useState } from "react";
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BadDoc {
  id: string;
  jobId?: string;
  jobName?: string;
  label?: string;
}

export default function CleanupFixturePhasesPage() {
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [docs, setDocs] = useState<BadDoc[] | null>(null);
  const [deleted, setDeleted] = useState(0);
  const [error, setError] = useState("");

  async function handleScan() {
    setScanning(true);
    setError("");
    setDocs(null);
    setDeleted(0);
    try {
      const snap = await getDocs(
        query(collection(db, "costingPhases"), where("subgrouping", "==", "FIXTURE"))
      );
      setDocs(
        snap.docs.map((d) => ({
          id: d.id,
          jobId: d.data().jobId,
          jobName: d.data().jobName,
          label: d.data().label,
        }))
      );
    } catch (err) {
      console.error(err);
      setError("Scan failed. Check console for details.");
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete() {
    if (!docs || docs.length === 0) return;
    setDeleting(true);
    setError("");
    try {
      const snap = await getDocs(
        query(collection(db, "costingPhases"), where("subgrouping", "==", "FIXTURE"))
      );
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      setDeleted(snap.docs.length);
      setDocs([]);
    } catch (err) {
      console.error(err);
      setError("Delete failed. Check console for details.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Cleanup: Fixture-sourced costingPhases
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Finds and deletes <code className="bg-gray-100 px-1 rounded">costingPhases</code> docs
          where <code className="bg-gray-100 px-1 rounded">subgrouping == &quot;FIXTURE&quot;</code>.
          These were created incorrectly by the old Mark Awarded flow and should be removed.
          Fixtures are now tracked in{" "}
          <code className="bg-gray-100 px-1 rounded">jobFixtures</code> instead.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || deleting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Scan for bad docs"}
        </button>
        {docs !== null && docs.length > 0 && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : `Delete all ${docs.length} docs`}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {deleted > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Deleted {deleted} fixture-sourced costingPhases rows successfully.
        </div>
      )}

      {docs !== null && docs.length === 0 && deleted === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No bad docs found — nothing to clean up.
        </div>
      )}

      {docs !== null && docs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              Found {docs.length} docs to delete
            </p>
          </div>
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Doc ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Job</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Label (fixture description)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{d.id}</td>
                  <td className="px-4 py-2.5 text-gray-700">{d.jobName ?? d.jobId ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">{d.label ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
