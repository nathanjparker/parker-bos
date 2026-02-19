"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { contactDisplayName, type Contact } from "@/types/companies";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
            <p className="mt-1 text-sm text-gray-600">{contacts.length} total</p>
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
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {["Name", "Company", "Title", "Phone", ""].map((h) => (
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
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
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
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {c.title || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="hover:text-blue-600">
                          {c.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/contacts/${c.id}/edit`}
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
