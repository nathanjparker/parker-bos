import type { Timestamp } from "firebase/firestore";

export interface CostingPhase {
  id: string;
  jobId: string;
  jobName: string;
  costCode: string;
  label: string;
  subgrouping: "CONTRACTED WORK" | "CHANGE ORDER";
  coId?: string;
  estMaterialCost: number;
  estLaborCost: number;
  estHours: number;
  mMarkup: number;
  lMarkup: number;
  contractValue: number;
  actualMaterials?: number;
  actualHours?: number;
  completedPct?: number;
  notes?: string;
  importedAt: Timestamp;
  updatedAt: Timestamp;
}

export const COST_CODE_LABELS: Record<string, string> = {
  GW: "Groundwork",
  RI: "Rough In",
  TRM: "Trim",
  WH: "Water Heater",
  GAS: "Gas Piping",
  FIX: "Fixture Cost",
};

export function calcContractValue(
  mCost: number,
  lCost: number,
  mMarkup: number,
  lMarkup: number
): number {
  return mCost * (1 + mMarkup / 100) + lCost * (1 + lMarkup / 100);
}

export function calcBillable(contractValue: number, pct?: number): number {
  return contractValue * ((pct ?? 0) / 100);
}

export interface ParsedPhaseRow {
  costCode: string;
  label: string;
  estMaterialCost: number;
  estLaborCost: number;
  estHours: number;
  mMarkup: number;
  lMarkup: number;
  contractValue: number;
}

/** Parse TSV clipboard data from estimating software into grouped phase rows. */
export function parseBudgetTSV(text: string): ParsedPhaseRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Raw rows keyed by cost code
  const grouped: Record<
    string,
    {
      mCost: number;
      lCost: number;
      hours: number;
      mMarkup: number;
      lMarkup: number;
    }
  > = {};

  function parseMoney(s: string): number {
    return parseFloat(s.replace(/[$,]/g, "")) || 0;
  }

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 3) continue;
    const costCode = cols[0].trim().toUpperCase();
    if (!costCode) continue;

    const mCost = parseMoney(cols[2] ?? "0");
    const lCost = parseMoney(cols[3] ?? "0");
    const mMarkup = parseFloat(cols[4] ?? "0") || 0;
    const lMarkup = parseFloat(cols[5] ?? "0") || 0;
    const hours = parseFloat(cols[6] ?? "0") || 0;

    // Skip zero rows
    if (mCost === 0 && lCost === 0 && hours === 0) continue;

    if (!grouped[costCode]) {
      grouped[costCode] = { mCost: 0, lCost: 0, hours: 0, mMarkup: 0, lMarkup: 0 };
    }
    grouped[costCode].mCost += mCost;
    grouped[costCode].lCost += lCost;
    grouped[costCode].hours += hours;
    // Take first non-zero markup values
    if (!grouped[costCode].mMarkup && mMarkup) grouped[costCode].mMarkup = mMarkup;
    if (!grouped[costCode].lMarkup && lMarkup) grouped[costCode].lMarkup = lMarkup;
  }

  return Object.entries(grouped).map(([costCode, vals]) => ({
    costCode,
    label: COST_CODE_LABELS[costCode] ?? costCode,
    estMaterialCost: vals.mCost,
    estLaborCost: vals.lCost,
    estHours: vals.hours,
    mMarkup: vals.mMarkup,
    lMarkup: vals.lMarkup,
    contractValue: calcContractValue(vals.mCost, vals.lCost, vals.mMarkup, vals.lMarkup),
  }));
}
