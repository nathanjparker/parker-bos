"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { formatPhoneDisplay, formatPhoneTel } from "@/lib/format";
import { contactDisplayName, type Contact } from "@/types/companies";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(c: Contact) {
    if (
      !window.confirm(
        `Delete contact "${contactDisplayName(c)}"? This cannot be undone.`
      )
    )
      return;
    setDeletingId(c.id);
    try {
      await deleteDoc(doc(db, "contacts", c.id));
    } catch (err) {
      console.error("Delete contact error:", err);
      alert("Failed to delete contact. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    const q = query(collection(db, "contacts"), orderBy("lastName", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setContacts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("contacts onSnapshot:", err);
        setLoading(false);
      }
    );
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const term = search.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        contactDisplayName(c).toLowerCase().includes(term) ||
        (c.companyName ?? "").toLowerCase().includes(term) ||
        (c.title ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
    );
  }, [contacts, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="mt-1 text-sm text-gray-600">
              {search.trim() && filtered.length !== contacts.length
                ? `${filtered.length} of ${contacts.length}`
                : `${contacts.length} total`}
            </p>
          </div>
          <Link
            href="/contacts/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + New Contact
          </Link>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            type="text"
            placeholder="Search by name, company, title, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {contacts.length === 0 ? "No contacts yet." : "No results."}
              </p>
              {contacts.length === 0 && (
                <Link
                  href="/contacts/new"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                >
                  + New Contact
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[160px]">Name</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[180px]">Company</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[160px]">Title</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[130px]">Phone</th>
                    <th className="bg-gray-50 px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {contactDisplayName(c)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[220px]">
                        <span className="block truncate">
                          {c.companyId ? (
                            <Link
                              href={`/companies/${c.companyId}`}
                              className="hover:text-blue-600 hover:underline"
                            >
                              {c.companyName || "—"}
                            </Link>
                          ) : (
                            c.companyName || "—"
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                        <span className="block truncate">{c.title || "—"}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {c.phone ? (
                          <a href={`tel:${formatPhoneTel(c.phone)}`} className="hover:text-blue-600">
                            {formatPhoneDisplay(c.phone)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/contacts/${c.id}/edit`}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            disabled={deletingId === c.id}
                            title="Delete contact"
                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-4 w-4"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                              />
                            </svg>
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
