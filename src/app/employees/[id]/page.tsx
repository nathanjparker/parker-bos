"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import FileList from "@/components/FileList";
import FileUpload from "@/components/FileUpload";
import { db } from "@/lib/firebase";
import { formatPhoneDisplay, formatPhoneTel } from "@/lib/format";
import {
  EMPLOYEE_ROLE_BADGE,
  EMPLOYEE_ROLES,
  employeeDisplayName,
  type Employee,
  type EmployeeRole,
} from "@/types/employees";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "employees", id), (snap) => {
      setEmployee(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Employee, "id">) } : null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">Employee not found.</p>
          <Link href="/employees" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Employees
          </Link>
        </div>
      </AppShell>
    );
  }

  const roleBadge =
    employee.role && EMPLOYEE_ROLES.includes(employee.role as EmployeeRole)
      ? EMPLOYEE_ROLE_BADGE[employee.role as EmployeeRole]
      : "bg-gray-100 text-gray-700";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <p className="text-xs text-gray-400">
          <Link href="/employees" className="hover:text-blue-600">← Employees</Link>
        </p>

        {/* Header */}
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{employeeDisplayName(employee)}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              {employee.role && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge}`}>
                  {employee.role}
                </span>
              )}
              {employee.status && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  employee.status === "Terminated"
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}>
                  {employee.status}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/employees/${id}/edit`}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 shrink-0"
          >
            Edit
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {/* Overview */}
          <Section title="Overview">
            {employee.hireDate && <InfoRow label="Hire Date">{employee.hireDate}</InfoRow>}
            {employee.birthday && <InfoRow label="Birthday">{employee.birthday}</InfoRow>}
            {employee.deviceNumber && <InfoRow label="Device #">{employee.deviceNumber}</InfoRow>}
          </Section>

          {/* Contact Info */}
          <Section title="Contact Info">
            {employee.phone && (
              <InfoRow label="Phone">
                <a href={`tel:${formatPhoneTel(employee.phone)}`} className="text-blue-600 hover:underline">
                  {formatPhoneDisplay(employee.phone)}
                </a>
              </InfoRow>
            )}
            {employee.email && (
              <InfoRow label="Work Email">
                <a href={`mailto:${employee.email}`} className="text-blue-600 hover:underline">
                  {employee.email}
                </a>
              </InfoRow>
            )}
            {employee.emailPersonal && (
              <InfoRow label="Personal Email">
                <a href={`mailto:${employee.emailPersonal}`} className="text-blue-600 hover:underline">
                  {employee.emailPersonal}
                </a>
              </InfoRow>
            )}
            {employee.homeAddress && (
              <InfoRow label="Home Address">
                <span className="whitespace-pre-line">{employee.homeAddress}</span>
              </InfoRow>
            )}
            {employee.partnerName && <InfoRow label="Partner">{employee.partnerName}</InfoRow>}
            {employee.partnerPhone && (
              <InfoRow label="Partner Phone">
                <a href={`tel:${employee.partnerPhone}`} className="text-blue-600 hover:underline">
                  {employee.partnerPhone}
                </a>
              </InfoRow>
            )}
            {employee.partnerEmail && (
              <InfoRow label="Partner Email">
                <a href={`mailto:${employee.partnerEmail}`} className="text-blue-600 hover:underline">
                  {employee.partnerEmail}
                </a>
              </InfoRow>
            )}
          </Section>

          {/* Emergency Contacts */}
          {(employee.emergencyContact1 || employee.emergencyContact2) && (
            <Section title="Emergency Contacts">
              {employee.emergencyContact1 && (
                <InfoRow label="Emergency Contact 1">{employee.emergencyContact1}</InfoRow>
              )}
              {employee.emergency1Phone && (
                <InfoRow label="EC1 Phone">
                  <a href={`tel:${formatPhoneTel(employee.emergency1Phone)}`} className="text-blue-600 hover:underline">
                    {formatPhoneDisplay(employee.emergency1Phone)}
                  </a>
                </InfoRow>
              )}
              {employee.emergencyContact2 && (
                <InfoRow label="Emergency Contact 2">{employee.emergencyContact2}</InfoRow>
              )}
              {employee.emergency2Phone && (
                <InfoRow label="EC2 Phone">
                  <a href={`tel:${formatPhoneTel(employee.emergency2Phone)}`} className="text-blue-600 hover:underline">
                    {formatPhoneDisplay(employee.emergency2Phone)}
                  </a>
                </InfoRow>
              )}
            </Section>
          )}

          {/* Licensing & Certs */}
          {(employee.licenseId || employee.licPlumbing || employee.licScissorLift || employee.licGas) && (
            <Section title="Licensing & Certs">
              {employee.licenseId && <InfoRow label="License ID">{employee.licenseId}</InfoRow>}
              {employee.licPlumbing && <InfoRow label="Plumbing License">{employee.licPlumbing}</InfoRow>}
              {employee.expPlumbing && <InfoRow label="Plumbing Expires">{employee.expPlumbing}</InfoRow>}
              {employee.licScissorLift && <InfoRow label="Scissor Lift">{employee.licScissorLift}</InfoRow>}
              {employee.licGas && <InfoRow label="Gas License">{employee.licGas}</InfoRow>}
              {employee.expGas && <InfoRow label="Gas Expires">{employee.expGas}</InfoRow>}
            </Section>
          )}

          {/* Files */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Files</h2>
              <FileUpload
                entityType="employee"
                entityId={id}
                entityName={employeeDisplayName(employee)}
              />
            </div>
            <FileList
              entityType="employee"
              entityId={id}
              entityName={employeeDisplayName(employee)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
