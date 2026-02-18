import type { Timestamp } from "firebase/firestore";

export type ProjectPhase =
  | "Lead"
  | "Bidding"
  | "Awarded"
  | "Active"
  | "Warranty"
  | "Closed"
  | "Lost";

export const PROJECT_PHASES: ProjectPhase[] = [
  "Lead",
  "Bidding",
  "Awarded",
  "Active",
  "Warranty",
  "Closed",
  "Lost",
];

export const PHASE_BADGE_CLASS: Record<ProjectPhase, string> = {
  Lead: "bg-gray-100 text-gray-700",
  Bidding: "bg-blue-100 text-blue-800",
  Awarded: "bg-yellow-100 text-yellow-800",
  Active: "bg-green-100 text-green-800",
  Warranty: "bg-purple-100 text-purple-800",
  Closed: "bg-slate-100 text-slate-700",
  Lost: "bg-red-100 text-red-700",
};

export interface Job {
  id: string;
  jobName: string;
  projectPhase: ProjectPhase;
  gcName?: string;
  gcId?: string;
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  estimatorId?: string;
  estimatorName?: string;
  pmId?: string;
  pmName?: string;
  superintendentId?: string;
  superintendentName?: string;
  originalContractValue?: number;
  currentContractValue?: number;
  bidDueDate?: Timestamp | null;
  submittedDate?: Timestamp | null;
  startDate?: Timestamp | null;
  completionDate?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}

export type ActivityTag = "General" | "Bidding" | "Sales" | "PM" | "Field";

export const ACTIVITY_TAGS: ActivityTag[] = [
  "General",
  "Bidding",
  "Sales",
  "PM",
  "Field",
];

export interface ActivityEntry {
  id: string;
  text: string;
  createdAt: Timestamp | null;
  createdBy: string;
  createdByName: string;
  tag: ActivityTag;
}
