"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { contactDisplayName, type Contact } from "@/types/companies";

type Props = {
  value: string[];                        // selected contact IDs
  onChange: (ids: string[]) => void;
};

export default function ContactMultiPicker({ value, onChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "contacts"), orderBy("lastName", "asc"));
    return onSnapshot(q, (snap) => {
      setContacts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) })));
      setLoading(false);
    });
  }, []);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => value.includes(c.id)),
    [contacts, value]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts.slice(0, 80);
    return contacts.filter((c) => {
      const name = contactDisplayName(c).toLowerCase();
      const title = (c.title ?? "").toLowerCase();
      const company = (c.companyName ?? "").toLowerCase();
      return name.includes(term) || title.includes(term) || company.includes(term);
    });
  }, [contacts, search]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
        Contacts
      </label>

      {/* Selected chips */}
      {selectedContacts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedContacts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
            >
              {contactDisplayName(c)}
              {c.title ? ` — ${c.title}` : ""}
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="ml-0.5 text-blue-500 hover:text-blue-800"
                aria-label={`Remove ${contactDisplayName(c)}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div className="relative">
        <input
          type="text"
          placeholder={loading ? "Loading contacts…" : "Search to add a contact…"}
          value={search}
          disabled={loading}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {open && !loading && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filtered.map((c) => {
              const selected = value.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => {
                      toggle(c.id);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      selected ? "bg-blue-50 text-blue-700" : "text-gray-900"
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300"
                    }`}>
                      {selected && (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 truncate">
                      {contactDisplayName(c)}
                      {c.title && <span className="ml-1 text-gray-500">— {c.title}</span>}
                      {c.companyName && <span className="ml-1 text-gray-400">({c.companyName})</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {open && !loading && search.trim() && filtered.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
            No contacts found for &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
