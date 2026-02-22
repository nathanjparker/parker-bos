export interface CostCode {
  id: string;
  code: string;      // e.g. "GW", "STEAM", "MISC01"
  label: string;     // e.g. "Groundwork", "Steam Work"
  sortOrder: number; // controls display ordering
}

/** Seed data — used by Settings page to auto-populate an empty costCodes collection. */
export const SEED_COST_CODES: Omit<CostCode, "id">[] = [
  // Construction
  { code: "GW",     label: "Groundwork",    sortOrder: 1  },
  { code: "RI",     label: "Rough In",      sortOrder: 2  },
  { code: "TRM",    label: "Trim",          sortOrder: 3  },
  { code: "WH",     label: "Water Heater",  sortOrder: 4  },
  { code: "GAS",    label: "Gas Piping",    sortOrder: 5  },
  { code: "FIX",    label: "Fixture Cost",  sortOrder: 6  },
  { code: "MISC01", label: "Miscellaneous", sortOrder: 7  },
  // Service
  { code: "LEAK",   label: "Leak Repair",   sortOrder: 10 },
  { code: "DRAIN",  label: "Drain Service", sortOrder: 11 },
  { code: "RPR",    label: "Repair",        sortOrder: 12 },
  { code: "INSP",   label: "Inspection",    sortOrder: 13 },
  { code: "INST",   label: "Installation",  sortOrder: 14 },
];
