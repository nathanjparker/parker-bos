import type { Timestamp } from "firebase/firestore";

export type EmployeeRole = "Owner" | "Journeyman" | "Apprentice" | "Admin" | "BookKeeper";

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  "Owner",
  "Journeyman",
  "Apprentice",
  "Admin",
  "BookKeeper",
];

export const EMPLOYEE_ROLE_BADGE: Record<EmployeeRole, string> = {
  Owner:      "bg-blue-100 text-blue-800",
  Journeyman: "bg-green-100 text-green-800",
  Apprentice: "bg-amber-100 text-amber-800",
  Admin:      "bg-purple-100 text-purple-800",
  BookKeeper: "bg-gray-100 text-gray-700",
};

export const EMPLOYEE_STATUS = ["Employed", "Terminated"] as const;
export type EmployeeStatus = typeof EMPLOYEE_STATUS[number];

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  status?: string;
  phone?: string;
  email?: string;
  emailPersonal?: string;
  homeAddress?: string;
  deviceNumber?: string;
  partnerName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  emergencyContact1?: string;
  emergency1Phone?: string;
  emergencyContact2?: string;
  emergency2Phone?: string;
  birthday?: string;      // YYYY-MM-DD
  hireDate?: string;      // YYYY-MM-DD
  licenseId?: string;
  licPlumbing?: string;
  expPlumbing?: string;   // YYYY-MM-DD
  licScissorLift?: string; // YYYY-MM-DD
  expGas?: string;        // YYYY-MM-DD
  licGas?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}

export function employeeDisplayName(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}
