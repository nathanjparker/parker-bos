"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  COMPANY_TYPE_BADGE,
  COMPANY_TYPE_LABEL,
  COMPANY_TYPES,
  type Company,
  type CompanyType,
} from "@/types/companies";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CompanyType | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");

  // Inline type editing
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  // Inline tag adding
  const [addingTagForId, setAddingTagForId] = useState<string | null>(null);
  const [inlineTagInput, setInlineTagInput] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);

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

  // Focus the inline input when it opens
  useEffect(() => {
    if (addingTagForId) {
      setTimeout(() => inlineInputRef.current?.focus(), 0);
    }
  }, [addingTagForId]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<CompanyType, number>> = {};
    for (const c of companies) {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of companies) {
      for (const t of c.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [companies]);

  const filtered = useMemo(() => {
    let list = companies;
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (tagFilter) list = list.filter((c) => c.tags?.includes(tagFilter));
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.city ?? "").toLowerCase().includes(term) ||
          (c.tags ?? []).some((t) => t.includes(term))
      );
    }
    return list;
  }, [companies, typeFilter, tagFilter, search]);

  async function updateType(companyId: string, type: CompanyType) {
    setEditingTypeId(null);
    await updateDoc(doc(db, "companies", companyId), { type });
  }

  async function saveInlineTag(companyId: string) {
    const tag = inlineTagInput.trim().toLowerCase();
    if (tag) {
      await updateDoc(doc(db, "companies", companyId), {
        tags: arrayUnion(tag),
      });
    }
    setAddingTagForId(null);
    setInlineTagInput("");
  }

  async function removeTag(companyId: string, tag: string) {
    await updateDoc(doc(db, "companies", companyId), {
      tags: arrayRemove(tag),
    });
  }

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
                {COMPANY_TYPE_LABEL[type]} ({count})
              </button>
            );
          })}
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  tagFilter === tag
                    ? "bg-violet-700 text-white"
                    : "bg-violet-100 text-violet-800 hover:bg-violet-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by name, city, or tag…"
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
                  {["Name", "Type", "Tags", "Phone", ""].map((h) => (
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
                      {editingTypeId === co.id ? (
                        <select
                          autoFocus
                          defaultValue={co.type}
                          onChange={(e) => updateType(co.id, e.target.value as CompanyType)}
                          onBlur={() => setEditingTypeId(null)}
                          className="rounded-lg border border-blue-400 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {COMPANY_TYPES.map((t) => (
                            <option key={t} value={t}>{COMPANY_TYPE_LABEL[t]}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingTypeId(co.id)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold hover:opacity-75 ${
                            COMPANY_TYPE_BADGE[co.type]
                          }`}
                        >
                          {COMPANY_TYPE_LABEL[co.type]}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {(co.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              tagFilter === tag
                                ? "bg-violet-700 text-white"
                                : "bg-violet-100 text-violet-700"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                              className="hover:opacity-70"
                            >
                              {tag}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTag(co.id, tag)}
                              className="ml-0.5 opacity-40 hover:opacity-100"
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {addingTagForId === co.id ? (
                          <input
                            ref={inlineInputRef}
                            type="text"
                            value={inlineTagInput}
                            onChange={(e) => setInlineTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); saveInlineTag(co.id); }
                              if (e.key === "Escape") { setAddingTagForId(null); setInlineTagInput(""); }
                            }}
                            onBlur={() => saveInlineTag(co.id)}
                            placeholder="tag name…"
                            className="w-24 rounded border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setAddingTagForId(co.id); setInlineTagInput(""); }}
                            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400 hover:border-violet-400 hover:text-violet-600"
                          >
                            + tag
                          </button>
                        )}
                      </div>
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
