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
  costCode: string;        // mapped from materialGroup via FASTPIPE_COST_CODE_MAP
  materialGroup: string;   // original FastPipe code, e.g. "02-EQG"
  quantity: number;
  size: string | null;     // null when FastPipe exports "<None>"
  description: string;
  sortOrder: number;
  manufacturer: string | null;      // from FastPipe col 5; null for By Others
  model: string | null;             // from FastPipe col 6; null for By Others
  budgetUnitPrice: number | null;   // from FastPipe col 7; null for By Others
}

export function calcConstructionRollup(phases: Pick<ConstructionEstimatePhase, "contractValue" | "estHours" | "estMaterialCost" | "estLaborCost">[]) {
  return {
    totalContractValue: phases.reduce((s, p) => s + p.contractValue, 0),
    totalHours:         phases.reduce((s, p) => s + p.estHours, 0),
    totalMaterialCost:  phases.reduce((s, p) => s + p.estMaterialCost, 0),
    totalLaborCost:     phases.reduce((s, p) => s + p.estLaborCost, 0),
  };
}

/** Material Group → cost code mapping for FastPipe's TSV export. */
export const FASTPIPE_COST_CODE_MAP: Record<string, string> = {
  "01-FXT": "TRM",
  "02-EQG": "GW",
  "02-EQR": "RI",
  "02-EQT": "TRM",
  "03-FXG": "GW",
  "03-FXR": "RI",
  "03-FXT": "TRM",
  "06-WH":  "WH",
  "07-GAS": "GAS",
  "08-HVC": "HVC",
  "09-M01": "MISC01",
  "09-M02": "MISC01",
  "demo":   "MISC01",
};

/** A single row parsed from FastPipe's TSV export (4-column legacy or 7-column v2). */
export interface ParsedFastPipeRow {
  materialGroup: string;          // original code, e.g. "02-EQG"
  costCode: string;               // mapped via FASTPIPE_COST_CODE_MAP
  quantity: number;
  size: string | null;            // null when FastPipe exports "<None>"
  description: string;
  manufacturer: string | null;    // col 5 (v2 only); null for By Others or legacy format
  model: string | null;           // col 6 (v2 only); null for By Others or legacy format
  budgetUnitPrice: number | null; // col 7 (v2 only); null for By Others or legacy format
}

/**
 * Parse FastPipe's TSV export.
 *
 * Legacy (4-col):  MaterialGroup | Qty | Size | Description
 * v2 (7+ col):     MaterialGroup | Qty | Size | Description... | Manufacturer | Model | UnitPrice
 *
 * Description can contain embedded tabs — in v2 format the last 3 columns are
 * always Manufacturer, Model, and UnitPrice, so we parse from the right end.
 */
export function parseFastPipeTSV(text: string): ParsedFastPipeRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedFastPipeRow[] = [];
  for (const line of lines) {
    const cells = line.split("\t");
    if (cells.length < 4) continue;
    const materialGroup = cells[0].trim();
    const quantity = Math.max(1, parseInt(cells[1].trim(), 10) || 1);
    const rawSize = cells[2].trim();
    const size = rawSize === "" || rawSize.toLowerCase() === "<none>" ? null : rawSize;

    let description: string;
    let manufacturer: string | null = null;
    let model: string | null = null;
    let budgetUnitPrice: number | null = null;

    if (cells.length >= 7) {
      // v2 format: last 3 columns are manufacturer, model, unit price
      // description occupies everything from col 4 up to the last 3
      description = cells.slice(3, cells.length - 3).join("\t").trim();
      const rawMfr = cells[cells.length - 3].trim();
      const rawModel = cells[cells.length - 2].trim();
      const rawPrice = cells[cells.length - 1].trim();
      manufacturer = rawMfr || null;
      model = rawModel || null;
      const parsed = parseFloat(rawPrice);
      budgetUnitPrice = isNaN(parsed) ? null : parsed;
    } else {
      // Legacy 4-column format
      description = cells.slice(3).join("\t").trim();
    }

    if (!materialGroup && !description) continue;
    const costCode = FASTPIPE_COST_CODE_MAP[materialGroup] ?? "MISC01";
    rows.push({ materialGroup, costCode, quantity, size, description, manufacturer, model, budgetUnitPrice });
  }
  return rows;
}
