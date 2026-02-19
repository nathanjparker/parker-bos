"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  EMPLOYEE_ROLE_BADGE,
  EMPLOYEE_ROLES,
  employeeDisplayName,
  type Employee,
  type EmployeeRole,
} from "@/types/employees";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "employees"), orderBy("lastName", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setEmployees(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("employees onSnapshot:", err);
        setLoading(false);
      }
    );
  }, []);

  const roleCounts = useMemo(() => {
    const counts: Partial<Record<EmployeeRole, number>> = {};
    for (const e of employees) {
      const r = e.role as EmployeeRole | undefined;
      if (r && EMPLOYEE_ROLES.includes(r)) {
        counts[r] = (counts[r] ?? 0) + 1;
      }
    }
    return counts;
  }, [employees]);

  const filtered = useMemo(() => {
    let list = employees;
    if (roleFilter) list = list.filter((e) => e.role === roleFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          employeeDisplayName(e).toLowerCase().includes(term) ||
          (e.email ?? "").toLowerCase().includes(term) ||
          (e.role ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [employees, roleFilter, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="mt-1 text-sm text-gray-600">{employees.length} total</p>
          </div>
          <Link
            href="/employees/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + New Employee
          </Link>
        </div>

        {/* Role filter tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoleFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              roleFilter === ""
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({employees.length})
          </button>
          {EMPLOYEE_ROLES.map((role) => {
            const count = roleCounts[role] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  roleFilter === role
                    ? "bg-gray-900 text-white"
                    : `${EMPLOYEE_ROLE_BADGE[role]} hover:opacity-80`
                }`}
              >
                {role} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by name, email, or role…"
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
                {employees.length === 0 ? "No employees yet." : "No results."}
              </p>
              {employees.length === 0 && (
                <Link
                  href="/employees/new"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                >
                  + New Employee
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {["Name", "Role", "Phone", "Hire Date", "Status", ""].map((h) => (
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
                {filtered.map((e) => {
                  const roleBadge =
                    e.role && EMPLOYEE_ROLES.includes(e.role as EmployeeRole)
                      ? EMPLOYEE_ROLE_BADGE[e.role as EmployeeRole]
                      : "bg-gray-100 text-gray-700";
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          href={`/employees/${e.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {employeeDisplayName(e)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {e.role ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge}`}>
                            {e.role}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {e.phone ? (
                          <a href={`tel:${e.phone}`} className="hover:text-blue-600">{e.phone}</a>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {e.hireDate || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {e.status || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/employees/${e.id}/edit`}
                          className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
