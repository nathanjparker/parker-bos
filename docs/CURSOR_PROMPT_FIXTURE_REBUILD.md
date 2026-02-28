# Cursor Prompt — Fixture Management UI Rebuild

Paste this entire prompt into Claude Code. Read the full prompt before writing any code.

---

```
I need to rebuild the fixture management UI for Parker BOS. 
Read FIXTURE_MANAGEMENT_REDESIGN.md and the existing 
src/app/jobs/[id]/fixtures/page.tsx before writing anything.

Here is exactly what needs to be built:

## PART 1 — FIXTURE DETAIL DRAWER

Build a right-side drawer component at:
src/components/fixtures/FixtureDetailDrawer.tsx

This drawer opens when a Parker Supplied fixture row is clicked 
(materialGroup starts with 01-, 02-, or 03-).
By Others fixtures (08-HVC, 09-M01, 09-M02, demo) are read-only 
and show a simplified view with optional PDF attachment only.

The drawer has four sections:

SECTION 1 — Specification:
- Description field (text, editable)
- Quantity (number, editable) and Size (text, editable) side by side
- Manufacturer (text field)
- Model (text field)  
- Web Link (URL field with an "Open →" button that opens in new tab)
- Budget Unit Price (read-only number, labeled: 
  "Estimate Reference — not the purchase price")

SECTION 2 — Procurement:
- Vendor (text field)
- Actual Unit Price (number field)
- Total (display only: quantity × actualUnitPrice, formatted as currency)
- Procurement Status (dropdown):
  Unspecified | Ordered | In Transit | Backordered | On-Site | Installed
- Date Needed By (date picker)
- Date Ordered (date picker)
- ETA (date picker)
- Date Delivered (date picker)
- PO Number (text field, labeled "PO # (optional — future feature)")

SECTION 3 — Submittal:
- Submittal Status (dropdown):
  Not Submitted | Submitted | Approved | Revise & Resubmit
- Notes (textarea, 3 rows)

SECTION 4 — Attachments:
- Show existing attachments as a list: filename, type badge, 
  "View" link, delete button
- Attachment types: Spec Sheet | Install Guide | Manual | Other
- Add attachment button: opens file picker (PDF only)
- Maximum 3 attachments per fixture
- On upload: save to Firebase Storage at:
  attachments/{jobId}/{fixtureId}/{filename}
- Save download URL + storagePath + filename + type + uploadedAt 
  to the fixture's attachments array in Firestore

Save behavior: 
- Show a "Save Changes" button at the bottom of the drawer
- Also save automatically when the drawer is closed if changes exist
- Update the fixture's updatedAt field on every save

Update the fixture list page to:
1. Make Parker Supplied rows clickable — clicking opens this drawer
2. Show a 📄 icon in the SPEC column when the fixture has at 
   least one attachment or a specSheetLibraryId set
3. Clicking the 📄 icon opens the first PDF directly (don't open drawer)
4. By Others rows show a subtle "By Others" label and are not 
   clickable for the full drawer (simplified view only)

## PART 2 — SPEC SHEET LIBRARY MODAL

Rebuild the existing Spec Library modal at:
src/components/fixtures/SpecLibraryModal.tsx

The modal has two tabs: Browse and Upload.

BROWSE TAB:
- Search bar: filters by manufacturer, model, or description
- List of all specSheetLibrary documents ordered by manufacturer
- Each row shows: manufacturer, model, description, version number, 
  "View PDF" link, "Link to fixture" button (only shown when called 
  from fixture drawer), "Update PDF" button
- "Update PDF" button: opens file picker, replaces current PDF, 
  increments version number, saves old URL to versionHistory array

UPLOAD TAB:
- Manufacturer (text, required)
- Model (text, required)
- Description (text, required — e.g. "Kohler Cimarron Elongated Toilet")
- PDF upload (required)
- Submit button
- Before saving, check if manufacturer + model combination already 
  exists (case-insensitive). If it does, warn the user and offer 
  to update the existing entry instead.
- On save: upload PDF to specSheets/library/{newDocId}/v1.pdf
  Create specSheetLibrary document with version: 1, usageCount: 0

Add a "Search Library" section to SECTION 1 of the fixture drawer:
- Small "Search spec library →" link below the manufacturer/model fields
- Clicking it opens the spec library modal in "link" mode
- When user selects a library entry, set specSheetLibraryId on the 
  fixture and save
- Show the linked spec sheet name with a "View" link and "Unlink" button

## PART 3 — SCHEMA UPDATES

Update src/types/fixtures.ts to add these fields to JobFixture:

specSheetLibraryId: string | null
attachments: FixtureAttachment[]

Add new interface FixtureAttachment:
{
  url: string
  filename: string
  type: "Spec Sheet" | "Install Guide" | "Manual" | "Other"
  uploadedAt: Timestamp
  storagePath: string
}

Add new interface SpecSheetLibraryEntry:
{
  id: string
  manufacturer: string
  model: string
  description: string
  pdfUrl: string
  storagePath: string
  version: number
  versionHistory: {
    version: number
    pdfUrl: string
    replacedAt: Timestamp
  }[]
  uploadedAt: Timestamp
  updatedAt: Timestamp
  usageCount: number
}

## PART 4 — BY OTHERS BEHAVIOR

By Others fixtures are identified by materialGroup:
08-HVC, 09-M01, 09-M02, demo

These rows in the fixture list:
- Show a subtle "By Others" text label in the phase column instead 
  of a colored badge
- Are NOT clickable for the full drawer
- Show a small paperclip icon if they have any attachments
- Clicking that icon opens a minimal "Attachments only" panel 
  (no procurement, no submittal, no manufacturer fields)
  with just the ability to view and upload PDFs

## RULES
- Show me all new and modified files before saving anything
- Do not modify handleMarkAwarded() — fixture migration already works
- Do not modify the constructionFixtures import logic
- Follow existing component patterns and Tailwind styling in the project
- The Firestore collection name is jobFixtures (camelCase)
- Firebase Storage is already configured — use the existing storage import
```
