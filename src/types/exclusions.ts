import type { Timestamp } from "firebase/firestore";

export interface Exclusion {
  id: string;
  text: string;
  sortOrder: number;
  active: boolean;
  createdAt?: Timestamp | null;
}

/** Seed data — used by the Exclusion Library settings page to auto-populate an empty collection. */
export const SEED_EXCLUSIONS: Omit<Exclusion, "id" | "createdAt">[] = [
  { text: "Permits (billed separately)", sortOrder: 1,  active: true },
  { text: "Engineered Drawings",         sortOrder: 2,  active: true },
  { text: "Plan Review",                 sortOrder: 3,  active: true },
  { text: "Insulation",                  sortOrder: 4,  active: true },
  { text: "Parking",                     sortOrder: 5,  active: true },
  { text: "Back flow devices",           sortOrder: 6,  active: true },
  { text: "Excavation",                  sortOrder: 7,  active: true },
  { text: "Backfill",                    sortOrder: 8,  active: true },
  { text: "Removal of Spoils",           sortOrder: 9,  active: true },
  { text: "Fixtures",                    sortOrder: 10, active: true },
  { text: "Water heater",                sortOrder: 11, active: true },
  { text: "Scoping",                     sortOrder: 12, active: true },
  { text: "Water Meter",                 sortOrder: 13, active: true },
  { text: "Lift / Rental",               sortOrder: 14, active: true },
  { text: "HVAC",                        sortOrder: 15, active: true },
  { text: "Temp Water",                  sortOrder: 16, active: true },
  { text: "Night Work",                  sortOrder: 17, active: true },
  { text: "Utility Locating",            sortOrder: 18, active: true },
  { text: "Heat Taping",                 sortOrder: 19, active: true },
];
