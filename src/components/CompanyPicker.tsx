"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Company } from "@/types/companies";

type Props = {
  label: string;
  value: string; // companyId or ""
  onChange: (companyId: string, companyName: string) => void;
  placeholder?: string;
};

export default function CompanyPicker({
  label,
  value,
  onChange,
  placeholder = "Select a company",
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "companies"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, "id">) })));
      setLoading(false);
    });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const companyId = e.target.value;
    const company = companies.find((c) => c.id === companyId);
    onChange(companyId, company?.name ?? "");
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
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.type ? ` (${c.type})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
