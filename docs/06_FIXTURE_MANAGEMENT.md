# Fixture Management Module

## Status
Discussed and schema defined. `jobFixtures` collection migration from `constructionFixtures` is being implemented as part of the Mark Awarded fix. The full fixture management UI (vendor, spec sheets, status tracking) is not yet built.

---

## What Was Decided

- Fixtures are NOT tracked in the budget card alongside labor/material phases
- Fixtures have their own dedicated tab in the job view (left nav or tab panel)
- The `constructionFixtures` collection is an import staging area per estimate — not permanent storage
- When an estimate is awarded, fixtures are migrated from `constructionFixtures` → `jobFixtures`
- `jobFixtures` is the permanent per-job fixture record
- Each fixture will eventually have vendor, web link, make, model, price, status, and spec sheet PDF
- Fixture status will be tracked (e.g. Unspecified → Submitted → Approved → Ordered → Delivered)
- Spec sheet PDFs will be stored in Firebase Storage and linked to the fixture record

---

## Schema / Data Model

### jobFixtures (new permanent collection)
```typescript
{
  // Identity
  jobId: string
  jobName: string
  estimateId: string              // Source estimate this came from
  bidName: string                 // Which bid this fixture belongs to

  // From FastPipe import
  materialGroup: string           // Original FastPipe code e.g. "02-EQG"
  costCode: string                // Mapped cost code e.g. "TRM"
  quantity: number
  size: string | null
  description: string
  sortOrder: number               // Preserves FastPipe import order

  // To be filled in post-award
  vendor: string | null
  make: string | null
  model: string | null
  unitPrice: number | null
  totalPrice: number | null       // quantity * unitPrice, calculated
  status: FixtureStatus
  webLink: string | null
  specSheetUrl: string | null     // Firebase Storage download URL
  submittalNotes: string | null

  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
}

type FixtureStatus =
  | "Unspecified"
  | "Submitted"
  | "Approved"
  | "On Order"
  | "Delivered"
  | "Rejected"
```

### constructionFixtures (estimate staging — existing)
```typescript
{
  estimateId: string
  costCode: string
  materialGroup: string
  quantity: number
  size: string | null
  description: string
  sortOrder: number
  // No vendor/price/status fields — this is import staging only
}
```

---

## File Paths

```
src/app/jobs/[id]/fixtures/page.tsx        — Fixture management tab (not yet built)
src/components/FixtureTable.tsx            — Fixture list component (not yet built)
src/components/FixtureEditModal.tsx        — Edit vendor/price/status per fixture (not yet built)
src/components/ConstructionEstimateBuilder.tsx  — Import staging source
src/components/EstimateBuilder.tsx         — Migration trigger (Mark Awarded)
```

---

## Business Logic

### Migration: constructionFixtures → jobFixtures on Award
When Mark Awarded runs:
1. Query all `constructionFixtures` where `estimateId == this estimate`
2. For each fixture, create a `jobFixtures` document with all FastPipe fields plus:
   - `jobId`, `jobName`, `estimateId`, `bidName`
   - All vendor/price/status fields set to `null` / `"Unspecified"`
3. Do NOT delete `constructionFixtures` — keep as estimate history

### Budget Card Exclusion
The project management budget card renders `costingPhases` only. It must never query or display `jobFixtures`. These are entirely separate views.

### Fixture Display — Job View
Fixtures shown in their own tab, grouped by `costCode` (GW, RI, TRM, WH, etc.), sorted by `sortOrder` within each group. Each row shows quantity, description, and status badge. Clicking a row opens edit modal for vendor/price/spec sheet.

### Spec Sheet Upload
- Upload PDF via Firebase Storage
- Store download URL in `jobFixtures.specSheetUrl`
- Display as a clickable link or thumbnail in the fixture row
- File naming convention: `jobs/{jobId}/fixtures/{fixtureId}/specsheet.pdf`

### Price Rollup (Future)
Once unit prices are filled in, the fixture tab should show:
- Per-line total (quantity × unitPrice)
- Subtotal by cost code group
- Grand total for all fixtures on the job
This is additive to the contract value but tracked separately from labor/material phases.

---

## What Is Intentionally Deferred

- Full fixture management UI (tab, table, edit modal)
- Spec sheet PDF upload interface
- Submittal management / submittal log
- Vendor assignment and preferred vendor lookup
- Fixture price rollup and comparison to estimate
- Automated spec sheet database (AI-assisted lookup by make/model)
- Fixture status workflow and notifications

---

## Open Questions

- What are all the fixture status values you use? (Draft list: Unspecified, Submitted, Approved, On Order, Delivered, Rejected)
- Who is responsible for populating vendor/price/spec sheet data — the estimator, PM, or Brittany?
- Are spec sheets stored anywhere currently (shared drive, email, etc.)?
- Should fixtures from different bids (Base Bid vs Alt Add 2) appear in separate sections if both are awarded, or merged into one list?
- Is there a submittal log that gets sent to the GC/architect, or is spec sheet management internal only?

---

## Key Context

- The `ParkerBOS_Fixture_Module_Build_v2.docx` in the project files contains earlier detailed planning for this module — cross-reference it when building the UI
- Fixture data originates in FastPipe and is imported at estimate creation time
- Fixtures represent physical plumbing fixtures and equipment (toilets, sinks, water heaters, HVAC units, etc.)
- Tracking vendor, make, model, and spec sheets is critical for submittal packages to architects/engineers
- This module is one of the more complex in the system due to the PDF storage and submittal workflow requirements
