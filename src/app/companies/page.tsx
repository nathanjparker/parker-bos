"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  COMPANY_TYPE_BADGE,
  COMPANY_TYPES,
  type Company,
  type CompanyType,
} from "@/types/companies";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CompanyType | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "companies"), orderBy("name", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setCompanies(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("companies onSnapshot:", err);
        setLoading(false);
      }
    );
  }, []);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<CompanyType, number>> = {};
    for (const c of companies) {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  const filtered = useMemo(() => {
    let list = companies;
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.city ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [companies, typeFilter, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
            <p className="mt-1 text-sm text-gray-600">{companies.length} total</p>
          </div>
          <Link
            href="/companies/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + New Company
          </Link>
        </div>

        {/* Type filter tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              typeFilter === ""
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({companies.length})
          </button>
          {COMPANY_TYPES.map((type) => {
            const count = typeCounts[type] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  typeFilter === type
                    ? "bg-gray-900 text-white"
                    : `${COMPANY_TYPE_BADGE[type]} hover:opacity-80`
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {companies.length === 0 ? "No companies yet." : "No results."}
              </p>
              {companies.length === 0 && (
                <Link
                  href="/companies/new"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                >
                  + New Company
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {["Name", "Type", "Location", "Phone", ""].map((h) => (
                    <th
                      key={h}
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((co) => (
                  <tr key={co.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/companies/${co.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {co.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          COMPANY_TYPE_BADGE[co.type]
                        }`}
                      >
                        {co.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {[co.city, co.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {co.phone || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/companies/${co.id}/edit`}
                        className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
