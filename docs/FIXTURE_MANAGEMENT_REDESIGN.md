# Fixture Management — UI Redesign Brief

## Status
Schema complete. UI needs full rebuild. This document supersedes earlier fixture UI notes.

---

## What Exists vs What's Needed

| What Exists | What's Needed |
|---|---|
| Fixture list with tabs and filters | ✅ Keep — structure is good |
| Phase grouping and status columns | ✅ Keep |
| Spec Sheet Library modal (empty) | ❌ Replace — needs real upload + search |
| Clicking a row does nothing useful | ❌ Fix — must open detail drawer |
| No way to edit manufacturer/model | ❌ Build — fixture detail drawer |
| No PDF upload | ❌ Build — multiple PDFs per fixture |
| Spec library not connected to fixtures | ❌ Build — auto-populate + manual link |

---

## Two Types of Fixtures — Different Behavior

### Parker Supplied (Parker Fixture + Parker Equipment tabs)
Full lifecycle tracking:
- Manufacturer / Model (from FastPipe, editable)
- Budget unit price (from FastPipe, read-only reference)
- Actual unit price (editable — real purchase price)
- Vendor
- Procurement status: Unspecified → Ordered → In Transit → Backordered → On-Site → Installed
- Submittal status: Not Submitted → Submitted → Approved → Revise & Resubmit
- Multiple PDFs attached (spec sheet, install guide, manual)
- Spec library auto-populate
- Web link
- Date needed by, date ordered, ETA, date delivered
- Notes
- PO number (future link to PO module)

### By Others tab (kitchen supplier, HVAC contractor, etc.)
Reference only — Parker needs visibility but doesn't manage procurement:
- Read-only display
- No procurement status tracking
- No submittal tracking
- PDF attachment optional (occasionally Parker has docs for these)
- No vendor/price fields
- Informational note: "Supplied by [others]"

---

## Fixture Detail Drawer

When a Parker Supplied fixture row is clicked, a right-side drawer slides open with:

### Header
- Description (editable for typos)
- Quantity + Size (editable)
- Phase badge (e.g. "Trim")
- Close button

### Section 1 — Specification
- Manufacturer (text field)
- Model (text field)
- Web Link (URL field with "Open" button)
- Budget Unit Price (read-only, shows FastPipe value, labeled "Estimate Reference — Not Purchase Price")
- Spec sheet attach area (see below)

### Section 2 — Procurement
- Vendor (text field)
- Actual Unit Price (number field)
- Total (calculated: qty × actual unit price, display only)
- Procurement Status (dropdown)
- Date Needed By (date picker)
- Date Ordered (date picker)
- ETA (date picker)
- Date Delivered (date picker)
- PO Number (text field, labeled "PO # (optional)")

### Section 3 — Submittal
- Submittal Status (dropdown)
- Notes (textarea)

### Section 4 — Attachments
- Up to 3 PDFs per fixture
- Each attachment shows: filename, type label (Spec Sheet / Install Guide / Manual / Other), open link, delete button
- Upload button: opens file picker, accepts PDF only
- On upload: saves to Firebase Storage at `attachments/{jobId}/{fixtureId}/{filename}`

### Save behavior
- Auto-save on field blur (not a save button) OR explicit Save button — pick one and be consistent
- updatedAt timestamp updated on every save

---

## Spec Sheet Library — Full Redesign

### Purpose
Global reusable library. Upload a spec sheet once, reuse it across any job that has the same fixture. When a spec sheet is updated (new model year, revised specs), update it in one place and it propagates.

### How It Works

**Uploading to the library:**
1. User clicks "Spec Library" button (top right of fixture page — already exists)
2. Library modal opens showing all saved spec sheets
3. Each entry shows: manufacturer, model, description, PDF preview link, date uploaded, version number
4. User can upload new spec sheet: enter manufacturer + model + description, upload PDF
5. If a spec sheet for that manufacturer+model already exists, prompt: "Update existing spec sheet?" — replaces PDF, increments version, keeps history

**Linking to a fixture:**
- In the fixture detail drawer, spec sheet section shows:
  - "Search library" button — opens searchable dropdown of library entries
  - Selecting one links the library entry to this fixture (stores `specSheetLibraryId` on jobFixture)
  - The linked spec sheet PDF is shown with a "View" button
  - If the library entry is later updated, the fixture automatically gets the new version (because it links to the library entry, not a copy of the PDF)
- User can also upload a one-off PDF directly to a fixture without adding it to the library (for job-specific docs)

**Auto-populate on award:**
When an estimate is awarded and fixtures are copied to `jobFixtures`, the system should:
1. For each fixture with manufacturer + model values
2. Query `specSheetLibrary` for matching manufacturer + model (case-insensitive)
3. If found: set `specSheetLibraryId` on the jobFixture automatically
4. If not found: leave null, show empty in drawer

**Spec indicator column in fixture list:**
- 📄 icon = spec sheet linked (from library or direct upload)
- Empty = no spec sheet yet
- Clicking the icon opens the PDF directly (don't open the drawer)

---

## Schema Updates Needed

### jobFixtures — add these fields
```typescript
specSheetLibraryId: string | null   // FK to specSheetLibrary if linked from library
specSheetUrl: string | null          // Direct upload URL (not from library)
attachments: FixtureAttachment[]     // Up to 3 additional PDFs
```

### FixtureAttachment (embedded in jobFixtures)
```typescript
{
  url: string              // Firebase Storage download URL
  filename: string         // Original filename
  type: "Spec Sheet" | "Install Guide" | "Manual" | "Other"
  uploadedAt: Timestamp
  storagePath: string      // For deletion: attachments/{jobId}/{fixtureId}/{filename}
}
```

### specSheetLibrary (global collection)
```typescript
{
  manufacturer: string
  model: string
  description: string         // Human-readable label e.g. "Kohler Cimarron Toilet"
  pdfUrl: string              // Firebase Storage download URL (current version)
  storagePath: string         // For replacement: specSheets/library/{id}/v{version}.pdf
  version: number             // Increments on each update, starts at 1
  versionHistory: {           // Array of previous versions
    version: number
    pdfUrl: string
    replacedAt: Timestamp
  }[]
  uploadedAt: Timestamp
  updatedAt: Timestamp
  usageCount: number          // How many jobFixtures currently link to this
}
```

---

## File Paths

```
src/app/jobs/[id]/fixtures/page.tsx          — Main fixture management page
src/components/fixtures/FixtureDetailDrawer.tsx   — Right-side drawer (build this)
src/components/fixtures/SpecLibraryModal.tsx      — Spec library upload/search modal
src/components/fixtures/AttachmentUploader.tsx    — PDF upload component
src/types/fixtures.ts                         — TypeScript interfaces
```

---

## Business Rules

1. Budget unit price from FastPipe is REFERENCE ONLY — label it clearly, never let it be overwritten by actual unit price
2. Actual unit price is what Parker pays — this feeds job costing eventually
3. By Others fixtures: display only, no edit capability except optional PDF attachment
4. Spec library links are live — if library entry updates, fixture gets new PDF automatically
5. Maximum 3 attachments per fixture (spec sheet counts as one if uploaded directly, not if linked from library)
6. Procurement status and submittal status are fully independent of each other
7. Spec sheet column icon is clickable — opens PDF directly without opening drawer

---

## Intentionally Out of Scope (This Build)

- Submittal package PDF generation (export all spec sheets as one PDF)
- PO creation from fixture (future PO module)
- Email/text alerts on status change
- Mobile optimized view
- Excel/PDF export of fixture schedule
- Bulk status update
