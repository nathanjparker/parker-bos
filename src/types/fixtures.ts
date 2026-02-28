import type { Timestamp } from "firebase/firestore";

export type ProcurementStatus =
  | "Unspecified"
  | "Ordered"
  | "In Transit"
  | "Backordered"
  | "On-Site"
  | "Installed";

export type SubmittalStatus =
  | "Not Submitted"
  | "Submitted"
  | "Approved"
  | "Revise & Resubmit";

export type AttachmentType = "Spec Sheet" | "Install Guide" | "Manual" | "Other";

export type FixtureCategory =
  | "Parker Fixture"
  | "Parker Equipment"
  | "Parker Misc"
  | "By Others";

// ── Attachment types ─────────────────────────────────────────────────────────

export interface FixtureAttachment {
  url: string;
  filename: string;
  type: AttachmentType;
  uploadedAt: Timestamp;
  storagePath: string;
}

export const ATTACHMENT_TYPES: AttachmentType[] = [
  "Spec Sheet",
  "Install Guide",
  "Manual",
  "Other",
];

// ── Spec Sheet Library ───────────────────────────────────────────────────────

export interface SpecSheetLibraryEntry {
  id: string;
  manufacturer: string;
  model: string;
  description: string;
  pdfUrl: string;
  storagePath: string;
  version: number;
  versionHistory: {
    version: number;
    pdfUrl: string;
    replacedAt: Timestamp;
  }[];
  uploadedAt: Timestamp;
  updatedAt: Timestamp;
  usageCount: number;
}

// ── Job Fixture ──────────────────────────────────────────────────────────────

export interface JobFixture {
  id: string;
  // Core identity — set at import/award, never editable
  jobId: string;
  jobName: string;
  estimateId: string;
  materialGroup: string;   // original FastPipe code; drives category classification
  costCode: string;        // mapped phase code: GW, RI, TRM, WH, GAS, HVC, MISC01
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Specification — from FastPipe import
  description: string;
  quantity: number;
  size: string | null;
  manufacturer: string | null;
  model: string | null;
  budgetUnitPrice: number | null;
  // Procurement — set by user post-award
  vendor: string | null;
  actualUnitPrice: number | null;
  dateNeededBy: Timestamp | null;
  dateOrdered: Timestamp | null;
  eta: Timestamp | null;
  dateDelivered: Timestamp | null;
  poNumber: string | null;
  notes: string | null;
  webLink: string | null;
  specSheetUrl: string | null;
  specSheetLibraryId: string | null;
  attachments: FixtureAttachment[];
  // Status
  procurementStatus: ProcurementStatus;
  submittalStatus: SubmittalStatus;
}

// ── Classification ────────────────────────────────────────────────────────────

const PARKER_FIXTURES = ["03-FXT", "03-FXR", "03-FXG"];
const PARKER_EQUIPMENT = ["02-EQG", "02-EQR", "02-EQT", "06-WH"];
const PARKER_MISC = ["09-M01", "09-M02", "demo"];

export function getFixtureCategory(mg: string): FixtureCategory {
  if (PARKER_FIXTURES.includes(mg)) return "Parker Fixture";
  if (PARKER_EQUIPMENT.includes(mg)) return "Parker Equipment";
  if (PARKER_MISC.includes(mg)) return "Parker Misc";
  return "By Others";
}

export function isParkerItem(mg: string): boolean {
  return getFixtureCategory(mg) !== "By Others";
}

export function getPhaseLabel(costCode: string): string {
  const map: Record<string, string> = {
    GW: "Groundwork",
    RI: "Rough-In",
    TRM: "Trim",
    WH: "Water Heater",
    GAS: "Gas",
    HVC: "HVAC",
    MISC01: "Misc",
  };
  return map[costCode] ?? costCode;
}

// ── Status lists ──────────────────────────────────────────────────────────────

export const PROCUREMENT_STATUSES: ProcurementStatus[] = [
  "Unspecified",
  "Ordered",
  "In Transit",
  "Backordered",
  "On-Site",
  "Installed",
];

export const SUBMITTAL_STATUSES: SubmittalStatus[] = [
  "Not Submitted",
  "Submitted",
  "Approved",
  "Revise & Resubmit",
];

// ── Status badge colors ───────────────────────────────────────────────────────

export const PROCUREMENT_COLORS: Record<ProcurementStatus, string> = {
  Unspecified:  "bg-gray-100 text-gray-600",
  Ordered:      "bg-blue-100 text-blue-700",
  "In Transit": "bg-yellow-100 text-yellow-700",
  Backordered:  "bg-red-100 text-red-700",
  "On-Site":    "bg-green-100 text-green-700",
  Installed:    "bg-purple-100 text-purple-700",
};

export const SUBMITTAL_COLORS: Record<SubmittalStatus, string> = {
  "Not Submitted":    "bg-gray-100 text-gray-600",
  Submitted:          "bg-blue-100 text-blue-700",
  Approved:           "bg-green-100 text-green-700",
  "Revise & Resubmit": "bg-red-100 text-red-700",
};

// ── Phase badge colors (by costCode) ─────────────────────────────────────────

export const PHASE_BADGE_COLORS: Record<string, string> = {
  GW:     "bg-amber-100 text-amber-700",
  RI:     "bg-blue-100 text-blue-700",
  TRM:    "bg-green-100 text-green-700",
  WH:     "bg-orange-100 text-orange-700",
  GAS:    "bg-slate-100 text-slate-600",
  HVC:    "bg-cyan-100 text-cyan-700",
  MISC01: "bg-gray-100 text-gray-600",
};

// ── Normalizers (backwards compatibility) ────────────────────────────────────

/** Convert legacy string[] attachments to FixtureAttachment[] */
export function normalizeAttachments(raw: unknown): FixtureAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      // Legacy: plain URL string
      const filename = decodeURIComponent(item.split("/").pop()?.split("?")[0] ?? "file.pdf");
      return {
        url: item,
        filename,
        type: "Other" as AttachmentType,
        uploadedAt: null as unknown as Timestamp,
        storagePath: "",
      };
    }
    // Already a FixtureAttachment object
    return item as FixtureAttachment;
  });
}
