import type { Timestamp } from "firebase/firestore";

export type COCategory =
  | "Owner Change"
  | "Field Condition"
  | "Design Error"
  | "Code Requirement"
  | "Other";

export type COStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Executed"
  | "Billed";

export const MATERIAL_MARKUP_TIERS = [
  { maxCost: 999, label: "Under $1,000", suggested: 50 },
  { maxCost: 4_999, label: "$1,000-$4,999", suggested: 30 },
  { maxCost: 9_999, label: "$5,000-$9,999", suggested: 20 },
  { maxCost: Infinity, label: "$10,000+", suggested: 15 },
] as const;

export function suggestMaterialMarkup(materialCost: number): number {
  const tier = MATERIAL_MARKUP_TIERS.find((t) => materialCost <= t.maxCost);
  return tier ? tier.suggested : 15;
}

export const LABOR_RATE_TIERS = [
  { maxHours: 9.99, label: "0-9.99 hrs", suggested: 250 },
  { maxHours: 19.99, label: "10-19.99 hrs", suggested: 200 },
  { maxHours: Infinity, label: "20+ hrs", suggested: 175 },
] as const;

export function suggestLaborRate(hours: number): number {
  const tier = LABOR_RATE_TIERS.find((t) => hours <= t.maxHours);
  return tier ? tier.suggested : 175;
}

export interface ChangeOrder {
  id: string;
  coNumber: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  subject: string;
  description: string;
  category: COCategory;
  laborHours: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  otherCost: number;
  laborBurden: number;
  laborBillingRate: number;
  materialMarkup: number;
  subMarkup: number;
  laborCost: number;
  laborBilling: number;
  laborMarkedUp: number;
  materialMarkedUp: number;
  subMarkedUp: number;
  amountRequested: number;
  amountApproved: number;
  status: COStatus;
  submittedAt?: Timestamp | null;
  underReviewAt?: Timestamp | null;
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvalDocUrl?: string;
  supportingDocs: string[];
  internalNotes?: string;
  clientNotes?: string;
  rejectionReason?: string;
  relatedInventoryItems?: string[];
  billedOnInvoiceId?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
