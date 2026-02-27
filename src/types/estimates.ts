import type { Timestamp } from "firebase/firestore";

export interface ServiceEstimate {
  id: string;
  jobId?: string;              // optional link to existing Job doc
  jobName: string;             // denormalized / free text
  jobNumber?: string;
  gcId?: string;               // contractor company
  gcName?: string;
  estimatorId?: string;        // parker employee estimating the job
  estimatorName?: string;
  status: "Draft" | "Opportunity" | "Awarded" | "Lost";
  type?: "install" | "construction"; // defaults to "install" for existing docs
  laborRate: number;           // $/hr billing rate  (default 350)
  laborBurden: number;         // $/hr cost to company (default 120)
  materialMarkup: number;      // % markup on materials (default 40)
  bidName?: string | null;       // e.g. "Base Bid", "Alt Add 1" — null when absent
  notes?: string;
  // Construction-specific narrative (stored as HTML from contentEditable)
  scopeOfWork?: string;
  exclusions?: string;
  clarifications?: string;
  selectedExclusions?: string[];   // texts of checked library exclusions
  // Stored rollup totals (recalculated on every line save)
  totalHours: number;
  totalLaborBilling: number;   // sum(hours) × laborRate
  totalMaterialCost: number;   // sum(rawMatCost)
  totalContractValue: number;  // laborBilling + matCost × (1 + mMarkup/100)
  profitMargin: number;        // see calcProfitMargin()
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EstimateLine {
  id: string;
  estimateId: string;
  costCode: string;
  description: string;
  laborHours: number;
  materialCost: number;   // raw cost (pre-markup)
  sortOrder: number;
  createdAt: Timestamp;
}

// Calculated client-side (never stored):
// laborTotal = laborHours × laborRate
// matTotal   = materialCost × (1 + mMarkup/100)
// lineTotal  = laborTotal + matTotal

/**
 * Profit margin formula:
 *   revenue = totalLaborBilling + totalMaterialCost × (1 + mMarkup/100)
 *   COGS    = totalHours × laborBurden + totalMaterialCost
 *   margin  = (revenue - COGS) / revenue × 100
 */
export function calcProfitMargin(
  totalHours: number,
  totalLaborBilling: number,
  totalMaterialCost: number,
  laborBurden: number,
  materialMarkup: number
): number {
  const revenue = totalLaborBilling + totalMaterialCost * (1 + materialMarkup / 100);
  if (revenue === 0) return 0;
  const cogs = totalHours * laborBurden + totalMaterialCost;
  return ((revenue - cogs) / revenue) * 100;
}

export function calcEstimateRollup(
  lines: Pick<EstimateLine, "laborHours" | "materialCost">[],
  laborRate: number,
  laborBurden: number,
  materialMarkup: number
): Pick<ServiceEstimate, "totalHours" | "totalLaborBilling" | "totalMaterialCost" | "totalContractValue" | "profitMargin"> {
  const totalHours = lines.reduce((s, l) => s + l.laborHours, 0);
  const totalMaterialCost = lines.reduce((s, l) => s + l.materialCost, 0);
  const totalLaborBilling = totalHours * laborRate;
  const totalContractValue = totalLaborBilling + totalMaterialCost * (1 + materialMarkup / 100);
  const profitMargin = calcProfitMargin(totalHours, totalLaborBilling, totalMaterialCost, laborBurden, materialMarkup);
  return { totalHours, totalLaborBilling, totalMaterialCost, totalContractValue, profitMargin };
}
