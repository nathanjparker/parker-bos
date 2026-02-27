# Estimate Module (Construction)

## Status
Partially built — Phase 1 actively in progress. Core estimate builder exists and is deployed. FastPipe import, exclusions library, and Mark Awarded handoff are being fixed and extended in the current build sprint.

---

## What Was Decided

- The construction estimate builder already exists at `src/components/ConstructionEstimateBuilder.tsx`
- FastPipe fixture data is a separate data source from budget/labor lines — they are NOT interchangeable
- Fixtures do NOT become costingPhases when an estimate is awarded
- costingPhases are created only from `estimateLines` (budget rows: Groundwork, Rough In, Trim, Water Heater, etc.)
- Fixtures are copied to `jobFixtures` collection on award (see 06_FIXTURE_MANAGEMENT.md)
- The exclusions library is managed centrally in settings and reused across all estimates
- All exclusions are checked by default; estimator unchecks the ones that don't apply to this job
- Selected exclusion text (not IDs) is stored on the estimate so it survives future library edits
- Multiple estimates can link to one job (base bid + alternate adds)
- Multiple estimates can be awarded additively — contract value accumulates

---

## Schema / Data Model

### estimates
```typescript
{
  jobId?: string
  jobName?: string
  bidName?: string | null          // "Base Bid", "Alt Add 1", "Alt Add 2", etc.
  gcId?: string
  gcName?: string
  estimatorId?: string
  estimatorName?: string
  status: "Draft" | "Opportunity" | "Awarded" | "Lost"
  type: "install" | "construction"
  laborRate: number
  laborBurden: number
  materialMarkup: number
  totalHours: number
  totalContractValue: number
  profitMargin: number
  selectedExclusions: string[]     // Full text strings, not IDs
  scopeOfWork?: string
  exclusionNotes?: string
  clarificationsAssumptions?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### estimateLines
```typescript
{
  estimateId: string
  costCode: string
  description: string
  laborHours: number
  materialCost: number
}
```

### constructionFixtures (import staging — per estimate)
```typescript
{
  estimateId: string
  costCode: string               // Mapped from materialGroup
  materialGroup: string          // Original FastPipe code e.g. "02-EQG"
  quantity: number
  size: string | null            // FastPipe <None> stored as null
  description: string
  sortOrder: number
}
```

### exclusionLibrary
```typescript
{
  text: string
  sortOrder: number
  active: boolean                // Default true
  createdAt: Timestamp
}
```

---

## FastPipe Import — Data Format

FastPipe exports tab-separated clipboard data with exactly 4 columns:

| Column | Field | Notes |
|---|---|---|
| 1 | Material Group | `01-FXT`, `02-EQG`, `03-FXT`, etc. |
| 2 | Quantity | Integer |
| 3 | Size | Fraction, number, or `<None>` |
| 4 | Description | Full item description including item code |

### Material Group → Cost Code Mapping
```
01-FXT  → TRM
02-EQG  → GW
02-EQR  → RI
02-EQT  → TRM
03-FXG  → GW
03-FXR  → RI
03-FXT  → TRM
06-WH   → WH
07-GAS  → GAS
08-HVC  → HVC
09-M01  → MISC01
09-M02  → MISC01
demo    → MISC01
(any unrecognized code) → MISC01
```

### Material Group Category Reference (from FastPipe)
```
00-MSC  Unused Plumbing Items
01-FXG  GW Fix/Equip Items (Others)
01-FXR  RI Fix/Equip Items (Others)
01-FXT  TRM Fix/Equip Items (Others)
02-EQG  GW Equipment (PS)
02-EQR  RI Equipment (PS)
02-EQT  TRM Equipment (PS)
03-FXG  GW Fixtures Items (PS)
03-FXR  RI Fixtures Items (PS)
03-FXT  TRM Fixtures Items (PS)
06-WH   Water Heater Items
07-GAS  Gas Items
08-HVC  HVAC Items
09-M01  Misc 1
09-M02  Misc 2
demo    Demolition
```

### Import Behavior
- Paste zone accepts raw clipboard output from FastPipe
- Parse 4-column TSV, map materialGroup to costCode automatically
- Show preview table before confirming: Cost Code | Qty | Size | Description | Delete
- User can delete individual rows before confirming
- On confirm: DELETE all existing constructionFixtures for this estimateId, write new batch
- Display after import: grouped by costCode, sorted by sortOrder within each group

---

## Exclusions Library

### Default Seed Data (seeded automatically when collection is empty)
```
1.  Permits (billed separately)
2.  Engineered Drawings
3.  Plan Review
4.  Insulation
5.  Parking
6.  Back flow devices
7.  Excavation
8.  Backfill
9.  Removal of Spoils
10. Fixtures
11. Water heater
12. Scoping
13. Water Meter
14. Lift / Rental
15. HVAC
16. Temp Water
17. Night Work
18. Utility Locating
19. Heat Taping
```

Seed runs on `/settings/exclusions` page load when collection has zero documents.

---

## File Paths

```
src/components/ConstructionEstimateBuilder.tsx   — Main estimate builder component
src/components/EstimateBuilder.tsx               — Mark Awarded flow, estimate form
src/app/settings/exclusions/page.tsx             — Exclusions library CRUD (new)
src/app/settings/page.tsx                        — Must link to exclusions page
```

---

## Business Logic

### Estimate Display Name Rule
- `bidName` present → display as `"JobName — BidName"` everywhere in the app
- `bidName` null → display as `"JobName"` (existing behavior, no change)

### Mark Awarded — Create New Job Path
1. Pre-fill job name from estimate's `jobName` field
2. Write new document to `Jobs` collection (capital J — critical)
3. Set on new Job: `estimateId`, `originalContractValue`, `currentContractValue`, `projectPhase: "Awarded"`, gcId/gcName, estimatorId/estimatorName
4. Save new `jobId` back to estimate document
5. Create `costingPhases` from `estimateLines` only — never from `constructionFixtures`
6. Copy `constructionFixtures` → `jobFixtures` (see Fixture Management doc)
7. Update estimate `status: "Awarded"`
8. Display link to `/jobs/[jobId]`

### Mark Awarded — Link to Existing Job Path
1. Show searchable dropdown of existing Jobs
2. Do NOT overwrite `originalContractValue`
3. ADD estimate's `totalContractValue` to `currentContractValue` using Firestore `increment()`
4. Create costingPhases tagged with this estimate's `bidName`
5. Copy fixtures to `jobFixtures`

### costingPhases from Award — Required Fields
Each phase document must include:
```
estimateId: string        // Source estimate ID
bidName: string           // estimate.bidName OR "Base Bid" if null
subgrouping: "CONTRACTED WORK"
```

### Exclusions — Checkbox Behavior
- Load all active exclusions from `exclusionLibrary` ordered by `sortOrder`
- All checked by default on new estimates
- User unchecks items that do NOT apply (most apply, only a few removed per job)
- `selectedExclusions` saves array of checked items' text strings
- On load of existing estimate: restore checkbox state by matching text values
- "Manage exclusions list" link opens `/settings/exclusions` in new tab

### Known Bugs Fixed in This Sprint
- `EstimateBuilder.tsx` was using `collection(db, "jobs")` (lowercase) — all instances changed to `"Jobs"` (capital J)
- Mark Awarded was creating costingPhases from fixtures — fixed to use estimateLines only
- Fixtures were incorrectly deleted rather than migrated to `jobFixtures`
- Exclusion library was not seeding — fixed with load-time seed check

---

## What Is Intentionally Deferred

- PDF generation for estimates and proposals (Phase 2)
- Email delivery + digital acceptance link workflow (Phase 3)
- Scope of work template / pre-fill from library
- Exclusions library: scope of work language per exclusion
- Estimate-to-estimate comparison view
- Per-fixture pricing populated at estimate stage (handled post-award in Fixture Management)
- FastPipe two-way sync or API integration (paste import is sufficient for now)

---

## Open Questions

- Does the GC receive all bid options simultaneously, or one at a time?
- Are there Material Group codes in your FastPipe library beyond what appeared in the sample data? Need to verify mapping is complete.
- Should lost estimates be archived/hidden from the main list, or remain visible?
- Is there a standard scope of work template that gets pre-filled, or always written from scratch per bid?

---

## Key Context

- Parker Services uses FastPipe estimating software for fixture/equipment scheduling
- Budget/labor data comes from a separate FastPipe T&M workbook — two distinct data sources per estimate
- Brittany handles data entry once a job is awarded — the job record must be pre-populated on award
- The Mark Awarded flow is the primary handoff between estimating and project management
- Real-world bids (e.g. "Skinner" restaurant remodel) regularly involve base bid + alternate adds to the same GC
- The GC can award base bid only, one alt add, or base bid plus an alt add — all scenarios must work
