"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { type Jurisdiction } from "@/types/jurisdictions";

export default function JurisdictionsPage() {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "jurisdictions"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setJurisdictions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Jurisdiction, "id">) }))
      );
      setLoading(false);
    });
  }, []);

  const filtered = search.trim()
    ? jurisdictions.filter((j) =>
        j.name.toLowerCase().includes(search.toLowerCase()) ||
        j.contactNames?.toLowerCase().includes(search.toLowerCase())
      )
    : jurisdictions;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jurisdictions</h1>
            <p className="mt-1 text-sm text-gray-500">
              Permit offices, inspection lines, and contacts.
            </p>
          </div>
          <Link
            href="/jurisdictions/new"
            className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Add Jurisdiction
          </Link>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            type="text"
            placeholder="Search jurisdictions or contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {search ? "No results." : "No jurisdictions yet. Run the import or add one."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/jurisdictions/${j.id}`}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{j.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {j.phone && <span>{j.phone}</span>}
                        {j.inspectionPhone && (
                          <span className="text-orange-600">Insp: {j.inspectionPhone}</span>
                        )}
                        {j.address && <span>{j.address}</span>}
                      </div>
                      {j.contactNames && (
                        <p className="mt-0.5 text-xs text-gray-400">{j.contactNames}</p>
                      )}
                    </div>
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-300 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            {filtered.length} of {jurisdictions.length} jurisdictions
          </p>
        )}
      </div>
    </AppShell>
  );
}
