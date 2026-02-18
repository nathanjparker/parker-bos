"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { contactDisplayName, type Contact } from "@/types/companies";

type Props = {
  label: string;
  value: string; // contactId or ""
  onChange: (contactId: string, contactName: string) => void;
  placeholder?: string;
};

export default function ContactPicker({ label, value, onChange, placeholder = "Select a contact" }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "contacts"), orderBy("lastName", "asc"));
    return onSnapshot(q, (snap) => {
      setContacts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }))
      );
      setLoading(false);
    });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const contactId = e.target.value;
    const contact = contacts.find((c) => c.id === contactId);
    const name = contact ? contactDisplayName(contact) : "";
    onChange(contactId, name);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={loading}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="">{loading ? "Loading…" : placeholder}</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {contactDisplayName(c)}
            {c.title ? ` — ${c.title}` : ""}
            {c.companyName ? ` (${c.companyName})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
