import type { Timestamp } from "firebase/firestore";

export type CompanyType = "GC" | "Sub" | "Vendor" | "Owner" | "Other";

export const COMPANY_TYPES: CompanyType[] = [
  "GC",
  "Sub",
  "Vendor",
  "Owner",
  "Other",
];

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  GC: "GC",
  Sub: "Sub",
  Vendor: "Vendor",
  Owner: "Business",
  Other: "Other",
};

export const COMPANY_TYPE_BADGE: Record<CompanyType, string> = {
  GC: "bg-blue-100 text-blue-800",
  Sub: "bg-purple-100 text-purple-800",
  Vendor: "bg-amber-100 text-amber-800",
  Owner: "bg-green-100 text-green-800",
  Other: "bg-gray-100 text-gray-700",
};

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  tags?: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  companyId?: string;   // optional — some contacts aren't linked to a company
  companyName?: string;
  title?: string;
  phone?: string;
  email?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}

export function contactDisplayName(c: Pick<Contact, "firstName" | "lastName">): string {
  return `${c.firstName} ${c.lastName}`.trim();
}
