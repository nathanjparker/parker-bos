"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABELS, EMPLOYEE_ROLES, EMPLOYEE_STATUS, type Employee } from "@/types/employees";

type FormValues = {
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  accessLevel: string;
  hireDate: string;
  birthday: string;
  phone: string;
  email: string;
  emailPersonal: string;
  homeAddress: string;
  deviceNumber: string;
  partnerName: string;
  partnerPhone: string;
  partnerEmail: string;
  emergencyContact1: string;
  emergency1Phone: string;
  emergencyContact2: string;
  emergency2Phone: string;
  licenseId: string;
  licPlumbing: string;
  expPlumbing: string;
  licScissorLift: string;
  expGas: string;
  licGas: string;
  authUid: string;
};

const EMPTY: FormValues = {
  firstName: "", lastName: "", role: "", status: "Employed", accessLevel: "office",
  hireDate: "", birthday: "",
  phone: "", email: "", emailPersonal: "", homeAddress: "", deviceNumber: "",
  partnerName: "", partnerPhone: "", partnerEmail: "",
  emergencyContact1: "", emergency1Phone: "", emergencyContact2: "", emergency2Phone: "",
  licenseId: "", licPlumbing: "", expPlumbing: "", licScissorLift: "", expGas: "", licGas: "",
  authUid: "",
};

function employeeToForm(e: Employee): FormValues {
  return {
    firstName: e.firstName ?? "", lastName: e.lastName ?? "",
    role: e.role ?? "", status: e.status ?? "Employed", accessLevel: e.accessLevel ?? "office",
    hireDate: e.hireDate ?? "", birthday: e.birthday ?? "",
    phone: e.phone ?? "", email: e.email ?? "",
    emailPersonal: e.emailPersonal ?? "", homeAddress: e.homeAddress ?? "",
    deviceNumber: e.deviceNumber ?? "",
    partnerName: e.partnerName ?? "", partnerPhone: e.partnerPhone ?? "",
    partnerEmail: e.partnerEmail ?? "",
    emergencyContact1: e.emergencyContact1 ?? "", emergency1Phone: e.emergency1Phone ?? "",
    emergencyContact2: e.emergencyContact2 ?? "", emergency2Phone: e.emergency2Phone ?? "",
    licenseId: e.licenseId ?? "", licPlumbing: e.licPlumbing ?? "",
    expPlumbing: e.expPlumbing ?? "", licScissorLift: e.licScissorLift ?? "",
    expGas: e.expGas ?? "", licGas: e.licGas ?? "",
    authUid: e.authUid ?? "",
  };
}

const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function EmployeeForm({
  employee,
  createdBy,
}: {
  employee?: Employee;
  createdBy: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(employee ? employeeToForm(employee) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.firstName.trim()) { setError("First name is required."); return; }
    if (!values.lastName.trim()) { setError("Last name is required."); return; }
    setSaving(true);
    setError(null);

    const s = (v: string) => v.trim() || undefined;

    const payload: Partial<Employee> = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      role: s(values.role),
      status: s(values.status),
      accessLevel: (values.accessLevel || "office") as Employee["accessLevel"],
      hireDate: s(values.hireDate),
      birthday: s(values.birthday),
      phone: s(values.phone),
      email: s(values.email),
      emailPersonal: s(values.emailPersonal),
      homeAddress: s(values.homeAddress),
      deviceNumber: s(values.deviceNumber),
      partnerName: s(values.partnerName),
      partnerPhone: s(values.partnerPhone),
      partnerEmail: s(values.partnerEmail),
      emergencyContact1: s(values.emergencyContact1),
      emergency1Phone: s(values.emergency1Phone),
      emergencyContact2: s(values.emergencyContact2),
      emergency2Phone: s(values.emergency2Phone),
      licenseId: s(values.licenseId),
      licPlumbing: s(values.licPlumbing),
      expPlumbing: s(values.expPlumbing),
      licScissorLift: s(values.licScissorLift),
      expGas: s(values.expGas),
      licGas: s(values.licGas),
      authUid: s(values.authUid),
    };

    try {
      if (employee) {
        await updateDoc(doc(db, "employees", employee.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        router.push(`/employees/${employee.id}`);
      } else {
        const ref = await addDoc(collection(db, "employees"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy,
        });
        router.push(`/employees/${ref.id}`);
      }
    } catch (err) {
      console.error("EmployeeForm save error:", err);
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Section title="Basic Info">
        <Field label="First Name *">
          <input type="text" className={inputCls} placeholder="Jane" value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)} required />
        </Field>
        <Field label="Last Name *">
          <input type="text" className={inputCls} placeholder="Smith" value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)} required />
        </Field>
        <Field label="Role">
          <select className={inputCls} value={values.role} onChange={(e) => set("role", e.target.value)}>
            <option value="">— Select role —</option>
            {EMPLOYEE_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={values.status} onChange={(e) => set("status", e.target.value)}>
            {EMPLOYEE_STATUS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Access Level">
          <select className={inputCls} value={values.accessLevel} onChange={(e) => set("accessLevel", e.target.value)}>
            {ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>{ACCESS_LEVEL_LABELS[l]}</option>
            ))}
          </select>
        </Field>
        <Field label="Hire Date">
          <input type="date" className={inputCls} value={values.hireDate}
            onChange={(e) => set("hireDate", e.target.value)} />
        </Field>
        <Field label="Birthday">
          <input type="date" className={inputCls} value={values.birthday}
            onChange={(e) => set("birthday", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Firebase Auth UID">
            <input type="text" className={inputCls} placeholder="Leave blank if unknown"
              value={values.authUid} onChange={(e) => set("authUid", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Contact Info">
        <Field label="Mobile Phone">
          <input type="tel" className={inputCls} placeholder="(206) 555-0100" value={values.phone}
            onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Company Email">
          <input type="email" className={inputCls} placeholder="jane@parkerservices.co"
            value={values.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Personal Email">
          <input type="email" className={inputCls} placeholder="jane@gmail.com"
            value={values.emailPersonal} onChange={(e) => set("emailPersonal", e.target.value)} />
        </Field>
        <Field label="Device / Work Phone">
          <input type="tel" className={inputCls} placeholder="(206) 555-0200"
            value={values.deviceNumber} onChange={(e) => set("deviceNumber", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Home Address">
            <input type="text" className={inputCls} placeholder="123 Main St, Seattle, WA 98101"
              value={values.homeAddress} onChange={(e) => set("homeAddress", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Partner">
        <Field label="Partner Name">
          <input type="text" className={inputCls} placeholder="Alex Smith" value={values.partnerName}
            onChange={(e) => set("partnerName", e.target.value)} />
        </Field>
        <Field label="Partner Phone">
          <input type="tel" className={inputCls} placeholder="(206) 555-0100" value={values.partnerPhone}
            onChange={(e) => set("partnerPhone", e.target.value)} />
        </Field>
        <Field label="Partner Email">
          <input type="email" className={inputCls} placeholder="alex@gmail.com" value={values.partnerEmail}
            onChange={(e) => set("partnerEmail", e.target.value)} />
        </Field>
      </Section>

      <Section title="Emergency Contacts">
        <Field label="Contact 1 Name">
          <input type="text" className={inputCls} placeholder="Parent / Spouse" value={values.emergencyContact1}
            onChange={(e) => set("emergencyContact1", e.target.value)} />
        </Field>
        <Field label="Contact 1 Phone">
          <input type="tel" className={inputCls} placeholder="(206) 555-0100" value={values.emergency1Phone}
            onChange={(e) => set("emergency1Phone", e.target.value)} />
        </Field>
        <Field label="Contact 2 Name">
          <input type="text" className={inputCls} placeholder="Secondary contact" value={values.emergencyContact2}
            onChange={(e) => set("emergencyContact2", e.target.value)} />
        </Field>
        <Field label="Contact 2 Phone">
          <input type="tel" className={inputCls} placeholder="(206) 555-0100" value={values.emergency2Phone}
            onChange={(e) => set("emergency2Phone", e.target.value)} />
        </Field>
      </Section>

      <Section title="Licensing & Certifications">
        <Field label="License ID">
          <input type="text" className={inputCls} placeholder="PL01-Commercial-..." value={values.licenseId}
            onChange={(e) => set("licenseId", e.target.value)} />
        </Field>
        <Field label="Plumbing License #">
          <input type="text" className={inputCls} placeholder="ROSSIJA883TM" value={values.licPlumbing}
            onChange={(e) => set("licPlumbing", e.target.value)} />
        </Field>
        <Field label="Plumbing Exp Date">
          <input type="date" className={inputCls} value={values.expPlumbing}
            onChange={(e) => set("expPlumbing", e.target.value)} />
        </Field>
        <Field label="Scissor Lift Cert Date">
          <input type="date" className={inputCls} value={values.licScissorLift}
            onChange={(e) => set("licScissorLift", e.target.value)} />
        </Field>
        <Field label="Gas License #">
          <input type="text" className={inputCls} placeholder="LIC-GP-..." value={values.licGas}
            onChange={(e) => set("licGas", e.target.value)} />
        </Field>
        <Field label="Gas License Exp Date">
          <input type="date" className={inputCls} value={values.expGas}
            onChange={(e) => set("expGas", e.target.value)} />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : employee ? "Save Changes" : "Add Employee"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
