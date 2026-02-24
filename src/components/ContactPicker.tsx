"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { contactDisplayName, type Contact } from "@/types/companies";

type Props = {
  label: string;
  value: string; // contactId or ""
  onChange: (contactId: string, contactName: string) => void;
  placeholder?: string;
};

export default function ContactPicker({
  label,
  value,
  onChange,
  placeholder = "Type to search…",
}: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "contacts"), orderBy("lastName", "asc"));
    return onSnapshot(q, (snap) => {
      setContacts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }))
      );
      setLoading(false);
    });
  }, []);

  const selectedContact = useMemo(
    () => (value ? contacts.find((c) => c.id === value) : null),
    [contacts, value]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts.slice(0, 80);
    return contacts.filter((c) => {
      const name = contactDisplayName(c).toLowerCase();
      const title = (c.title ?? "").toLowerCase();
      const company = (c.companyName ?? "").toLowerCase();
      return (
        name.includes(term) ||
        title.includes(term) ||
        company.includes(term)
      );
    });
  }, [contacts, search]);

  const displayValue = selectedContact
    ? contactDisplayName(selectedContact)
    : search;

  function handleFocus() {
    setOpen(true);
    if (value) setSearch("");
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      if (value && selectedContact) setSearch("");
    }, 180);
  }

  function selectContact(c: Contact) {
    const name = contactDisplayName(c);
    onChange(c.id, name);
    setSearch("");
    setOpen(false);
  }

  function clearSelection() {
    onChange("", "");
    setSearch("");
    setOpen(true);
  }

  return (
    <div ref={containerRef}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            if (value) onChange("", "");
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={loading}
          placeholder={loading ? "Loading…" : placeholder}
          autoComplete="off"
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {value && selectedContact && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {open && !loading && filtered.length > 0 && (
          <ul
            className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {filtered.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectContact(c)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    c.id === value ? "bg-blue-50 text-blue-800" : "text-gray-900"
                  }`}
                >
                  <span className="font-medium">
                    {contactDisplayName(c)}
                  </span>
                  {(c.title || c.companyName) && (
                    <span className="text-gray-500">
                      — {[c.title, c.companyName].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
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
