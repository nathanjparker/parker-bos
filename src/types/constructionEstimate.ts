import type { Timestamp } from "firebase/firestore";

export interface ConstructionEstimatePhase {
  id: string;
  estimateId: string;
  costCode: string;
  label: string;
  estMaterialCost: number;
  estLaborCost: number;
  estHours: number;
  mMarkup: number;
  lMarkup: number;
  contractValue: number;
  sortOrder: number;
  importedAt: Timestamp;
}

export interface ConstructionFixture {
  id: string;
  estimateId: string;
  category: string;       // "Fixture", "Water Heater", etc.
  manufacturer?: string;
  model?: string;
  description: string;
  quantity: number;
  unitCost?: number;
  tag?: string;           // future: submittal reference
  sortOrder: number;
}

export function calcConstructionRollup(phases: Pick<ConstructionEstimatePhase, "contractValue" | "estHours" | "estMaterialCost" | "estLaborCost">[]) {
  return {
    totalContractValue: phases.reduce((s, p) => s + p.contractValue, 0),
    totalHours:         phases.reduce((s, p) => s + p.estHours, 0),
    totalMaterialCost:  phases.reduce((s, p) => s + p.estMaterialCost, 0),
    totalLaborCost:     phases.reduce((s, p) => s + p.estLaborCost, 0),
  };
}

/** Parsed row from pasted fixture TSV (e.g. from Excel/Sheets). */
export interface ParsedFixtureRow {
  category: string;
  manufacturer: string;
  model: string;
  description: string;
  quantity: number;
  unitCost: number;
  tag: string;
}

const FIXTURE_HEADERS = ["category", "manufacturer", "model", "description", "quantity", "unitcost", "unit cost", "qty", "tag"];

function parseMoney(s: string): number {
  return parseFloat(String(s).replace(/[$,]/g, "")) || 0;
}

/** Parse tab- or comma-separated fixture data. First row may be a header. */
export function parseFixtureTSV(text: string): ParsedFixtureRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const rows: ParsedFixtureRow[] = [];
  let start = 0;
  const firstCells = lines[0].split(/\t|,/).map((c) => c.trim().toLowerCase());
  const looksLikeHeader = firstCells.length >= 2 && FIXTURE_HEADERS.some((h) => firstCells[0].includes(h) || firstCells.some((c) => c === h));
  if (looksLikeHeader) start = 1;
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(/\t|,/).map((c) => c.trim());
    if (cells.length < 2) continue;
    const category = cells[0] ?? "";
    const manufacturer = cells[1] ?? "";
    const model = cells[2] ?? "";
    const description = cells[3] ?? "";
    const quantity = Math.max(0, parseInt(cells[4] ?? "1", 10) || 1);
    const unitCost = parseMoney(cells[5] ?? "0");
    const tag = cells[6] ?? "";
    if (!category && !description && !manufacturer) continue;
    rows.push({ category, manufacturer, model, description, quantity, unitCost, tag });
  }
  return rows;
}
