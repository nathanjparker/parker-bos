import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CostingPhase } from "@/types/costing";

// ── Session Type ─────────────────────────────────────────────────────────────

export type SessionType =
  | "phase-work"
  | "site-visit"
  | "coordination"
  | "warranty"
  | "mobilization"
  | "other";

export type SessionStatus =
  | "tentative"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";

export type GapReason =
  | "inspection"
  | "materials"
  | "other-trade"
  | "GC-direction"
  | "weather"
  | "other";

export type CrewRole = "journeyman" | "apprentice" | "foreman";

// ── Label Maps ───────────────────────────────────────────────────────────────

export const PHASE_LABELS: Record<string, string> = {
  GW: "Groundwork",
  RI: "Rough-In",
  TRM: "Trim",
  WH: "Water Heater",
  GAS: "Gas",
  HVC: "HVAC",
  MISC01: "Misc",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "phase-work": "Phase Work",
  "site-visit": "Site Visit",
  coordination: "Coordination",
  warranty: "Warranty",
  mobilization: "Mobilization",
  other: "Other",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SESSION_STATUS_COLORS: Record<SessionStatus, string> = {
  tentative: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  "in-progress": "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export const GAP_REASON_LABELS: Record<GapReason, string> = {
  inspection: "Waiting on Inspection",
  materials: "Waiting on Materials",
  "other-trade": "Waiting on Other Trade",
  "GC-direction": "Waiting on GC Direction",
  weather: "Weather",
  other: "Other",
};

// ── Schedule Session ─────────────────────────────────────────────────────────

export interface ScheduleSession {
  id: string;

  // Job & Phase Link
  jobId: string;
  jobNumber: string;
  jobName: string;
  costingPhaseId: string;
  costCode: string;
  phaseLabel: string;

  // Session Type
  sessionType: SessionType;

  // Dates
  startDate: Timestamp;
  endDate: Timestamp;
  hoursPerDay: number;
  includesWeekend: boolean;

  // Status
  status: SessionStatus;

  // Crew Assignment
  assignedCrew: Array<{
    employeeId: string;
    employeeName: string;
    role?: CrewRole | null;
    hoursPerDay?: number;
  }>;
  assignedCrewIds: string[];

  // Gap Tracking
  gapInfo?: {
    waitingOn: GapReason;
    waitingNote?: string;
    earliestReturnDate?: Timestamp | null;
  } | null;

  // Completion
  completionNote?: string | null;
  completedAt?: Timestamp | null;
  completedBy?: string | null;

  // Lightweight hour log (interim — replaced by time tracking module later)
  loggedHours?: number | null;

  // Note
  note?: string | null;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ── Scheduled Work (Time Tracking Bridge) ────────────────────────────────────

export interface ScheduledWork {
  sessionId: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  costCode: string;
  phaseLabel: string;

  employeeId: string;
  employeeName: string;
  role?: CrewRole | null;
  scheduledDate: Timestamp;
  scheduledHours: number;
}

// ── Capacity Math ────────────────────────────────────────────────────────────

export function getRemainingHours(phase: CostingPhase): number {
  return phase.estHours * (1 - (phase.completedPct ?? 0) / 100);
}

export function getSessionCapacity(session: ScheduleSession): number {
  const start = session.startDate.toDate();
  const end = session.endDate.toDate();
  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend || session.includesWeekend) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  const hoursPerDay = session.assignedCrew.reduce((sum, crew) => {
    return sum + (crew.hoursPerDay ?? session.hoursPerDay);
  }, 0);

  return hoursPerDay * workingDays;
}

export type CapacityStatus = "sufficient" | "short" | "over";

export function getCapacityStatus(
  sessionCapacity: number,
  remainingHours: number
): { status: CapacityStatus; difference: number } {
  const diff = sessionCapacity - remainingHours;
  if (diff >= 0) return { status: "sufficient", difference: diff };
  if (diff >= -8) return { status: "short", difference: diff };
  return { status: "over", difference: diff };
}

// ── Budget Warnings ──────────────────────────────────────────────────────────

export type BudgetWarning = "normal" | "warning" | "critical" | "over-budget";

export function getBudgetWarning(phase: CostingPhase): BudgetWarning {
  const remainingPct = 100 - (phase.completedPct ?? 0);

  if ((phase.actualHours ?? 0) > phase.estHours) return "over-budget";
  if (remainingPct <= 0) return "over-budget";
  if (remainingPct <= 10) return "critical";
  if (remainingPct <= 25) return "warning";
  return "normal";
}

export const BUDGET_WARNING_COLORS: Record<BudgetWarning, string> = {
  normal: "",
  warning: "bg-yellow-100 text-yellow-700",
  critical: "bg-orange-100 text-orange-700",
  "over-budget": "bg-red-100 text-red-700",
};

export const BUDGET_WARNING_LABELS: Record<BudgetWarning, string> = {
  normal: "",
  warning: "25% hours remaining",
  critical: "10% hours remaining",
  "over-budget": "Over budget",
};

// ── Explode Session to Scheduled Work ────────────────────────────────────────

export function explodeSessionToScheduledWork(
  session: ScheduleSession
): ScheduledWork[] {
  const records: ScheduledWork[] = [];
  const current = new Date(session.startDate.toDate());
  const end = new Date(session.endDate.toDate());

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend || session.includesWeekend) {
      for (const crew of session.assignedCrew) {
        records.push({
          sessionId: session.id,
          jobId: session.jobId,
          jobNumber: session.jobNumber,
          jobName: session.jobName,
          costCode: session.costCode,
          phaseLabel: session.phaseLabel,
          employeeId: crew.employeeId,
          employeeName: crew.employeeName,
          role: crew.role ?? null,
          scheduledDate: Timestamp.fromDate(new Date(current)),
          scheduledHours: crew.hoursPerDay ?? session.hoursPerDay,
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return records;
}

// ── Conflict Detection ───────────────────────────────────────────────────────

export interface CrewConflict {
  employeeId: string;
  employeeName: string;
  conflictingSession: ScheduleSession;
}

export async function checkCrewConflicts(
  session: Partial<ScheduleSession>,
  excludeSessionId?: string
): Promise<CrewConflict[]> {
  const conflicts: CrewConflict[] = [];

  for (const crew of session.assignedCrew ?? []) {
    const q = query(
      collection(db, "scheduleSessions"),
      where("assignedCrewIds", "array-contains", crew.employeeId),
      where("status", "in", ["tentative", "confirmed", "in-progress"]),
      where("startDate", "<=", session.endDate)
    );

    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id === excludeSessionId) continue;
      const existing = { id: d.id, ...d.data() } as ScheduleSession;
      if (existing.endDate.toDate() >= session.startDate!.toDate()) {
        conflicts.push({
          employeeId: crew.employeeId,
          employeeName: crew.employeeName,
          conflictingSession: existing,
        });
      }
    }
  }
  return conflicts;
}
