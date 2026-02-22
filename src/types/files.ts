import type { Timestamp } from "firebase/firestore";

export type FileEntity = "job" | "employee" | "other";

export type JobFileCategory =
  | "Schedule"
  | "Workbook"
  | "Contract/Bid"
  | "Permits"
  | "Bid Plans"
  | "Active Plans"
  | "Health Plans"
  | "Fix/Equip (Others)"
  | "Fix/Equip (PS)"
  | "COI Doc"
  | "Site Safety Doc"
  | "Lien Intent"
  | "Pictures"
  | "Close Out Docs";

export const JOB_FILE_CATEGORIES: JobFileCategory[] = [
  "Schedule",
  "Workbook",
  "Contract/Bid",
  "Permits",
  "Bid Plans",
  "Active Plans",
  "Health Plans",
  "Fix/Equip (Others)",
  "Fix/Equip (PS)",
  "COI Doc",
  "Site Safety Doc",
  "Lien Intent",
  "Pictures",
  "Close Out Docs",
];

/** File phases for the job Files card header; categories are grouped under these. */
export type JobFilePhase = "Bidding" | "Awarded" | "Active" | "Close out";

export const JOB_FILE_PHASES: JobFilePhase[] = [
  "Bidding",
  "Awarded",
  "Active",
  "Close out",
];

/** Categories shown under each phase. */
export const CATEGORIES_BY_PHASE: Record<JobFilePhase, JobFileCategory[]> = {
  Bidding: ["Contract/Bid", "Bid Plans", "Workbook", "Pictures"],
  Awarded: ["Contract/Bid", "Workbook", "Schedule", "Permits", "COI Doc", "Site Safety Doc"],
  Active: [
    "Schedule",
    "Permits",
    "Active Plans",
    "Health Plans",
    "Fix/Equip (Others)",
    "Fix/Equip (PS)",
  ],
  "Close out": ["Lien Intent", "Close Out Docs"],
};

/** Default file phase to show based on job projectPhase. */
export function defaultFilePhaseForJob(projectPhase: string): JobFilePhase {
  switch (projectPhase) {
    case "Lead":
    case "Bidding":
      return "Bidding";
    case "Awarded":
      return "Awarded";
    case "Active":
    case "Install":
    case "Warranty":
      return "Active";
    case "Closed":
    case "Lost":
      return "Close out";
    default:
      return "Active";
  }
}

export interface AppFile {
  id: string;
  name: string;          // original filename
  storagePath: string;   // Firebase Storage path (used for deleteObject)
  downloadUrl: string;   // from getDownloadURL
  size: number;          // bytes
  contentType: string;   // MIME type
  entityType: FileEntity;
  entityId: string;
  entityName?: string;   // denormalized: job name / employee name / "General"
  category?: string;     // JobFileCategory — only set when entityType === "job"
  uploadedBy: string;    // user email
  uploadedAt: Timestamp;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
