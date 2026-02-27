# Parker BOS — Codebase Audit

> Generated 2026-02-26. Covers every file in `src/` and `functions/`.

---

## Table of Contents

1. [Firestore Collections](#1-firestore-collections)
2. [Pages & Routes](#2-pages--routes)
3. [Components](#3-components)
4. [TypeScript Interfaces & Types](#4-typescript-interfaces--types)
5. [Cloud Functions](#5-cloud-functions)
6. [Firebase Storage Paths](#6-firebase-storage-paths)
7. [Navigation Structure](#7-navigation-structure)
8. [Build Status — What's Done vs Incomplete](#8-build-status)

---

## 1. Firestore Collections

### `Jobs` *(capital J)*
Top-level job records.

| Field | Type | Notes |
|---|---|---|
| `jobName` | string | |
| `projectPhase` | string | Lead \| Bidding \| Opportunity \| Awarded \| Active \| Install \| Warranty \| Closed \| Lost |
| `gcName` | string? | |
| `gcId` | string? | FK → `companies` |
| `siteAddress` | string? | |
| `siteCity` | string? | |
| `siteState` | string? | |
| `siteZip` | string? | |
| `estimatorId` | string? | FK → `contacts` |
| `estimatorName` | string? | Denormalized |
| `pmId` | string? | FK → `contacts` |
| `pmName` | string? | Denormalized |
| `superintendentId` | string? | FK → `contacts` |
| `superintendentName` | string? | Denormalized |
| `jurisdictionId` | string? | FK → `jurisdictions` |
| `jurisdictionName` | string? | Denormalized |
| `originalContractValue` | number? | Set at award, never changed |
| `currentContractValue` | number? | Incremented by approved COs |
| `parcelNumber` | string? | |
| `bidDueDate` | Timestamp? | |
| `submittedDate` | Timestamp? | |
| `startDate` | Timestamp? | |
| `completionDate` | Timestamp? | |
| `estimateId` | string? | FK → `estimates` (linked construction estimate) |
| `createdAt` | Timestamp? | |
| `updatedAt` | Timestamp? | |
| `createdBy` | string? | Auth UID |

**Subcollection: `Jobs/{jobId}/activity`**

| Field | Type | Notes |
|---|---|---|
| `text` | string | Rich-text note body |
| `tag` | string | General \| Bidding \| Sales \| PM \| Field |
| `createdAt` | Timestamp | |
| `createdBy` | string | Auth UID |
| `createdByName` | string | Display name |

---

### `companies`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `type` | string | GC \| Sub \| Vendor \| Owner \| Other |
| `phone` | string? | |
| `email` | string? | |
| `address` | string? | |
| `city` | string? | |
| `state` | string? | |
| `zip` | string? | |
| `website` | string? | |
| `tags` | string[]? | User-defined tags |
| `createdAt` | Timestamp? | |
| `updatedAt` | Timestamp? | |
| `createdBy` | string? | |

---

### `contacts`

| Field | Type | Notes |
|---|---|---|
| `firstName` | string | |
| `lastName` | string | |
| `companyId` | string? | FK → `companies` |
| `companyName` | string? | Denormalized |
| `title` | string? | |
| `phone` | string? | |
| `email` | string? | |
| `createdAt` | Timestamp? | |
| `updatedAt` | Timestamp? | |
| `createdBy` | string? | |

---

### `jurisdictions`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `state` | string? | |
| `phone` | string? | |
| `inspectionPhone` | string? | |
| `address` | string? | |
| `website` | string? | |
| `notes` | string? | |
| `contactIds` | string[]? | FKs → `contacts` |
| `contactNames` | string? | Denormalized |
| `createdAt` | Timestamp? | |
| `updatedAt` | Timestamp? | |
| `createdBy` | string? | |

---

### `employees`

| Field | Type | Notes |
|---|---|---|
| `firstName` | string | |
| `lastName` | string | |
| `role` | string? | Owner \| Journeyman \| Apprentice \| Admin \| BookKeeper |
| `status` | string? | Employed \| Terminated |
| `phone` | string? | |
| `email` | string? | Work email |
| `emailPersonal` | string? | |
| `homeAddress` | string? | |
| `deviceNumber` | string? | |
| `partnerName` | string? | |
| `partnerPhone` | string? | |
| `partnerEmail` | string? | |
| `emergencyContact1` | string? | |
| `emergency1Phone` | string? | |
| `emergencyContact2` | string? | |
| `emergency2Phone` | string? | |
| `birthday` | string? | YYYY-MM-DD |
| `hireDate` | string? | YYYY-MM-DD |
| `licenseId` | string? | |
| `licPlumbing` | string? | License number |
| `expPlumbing` | string? | YYYY-MM-DD |
| `licScissorLift` | string? | YYYY-MM-DD (expiry stored as license) |
| `expGas` | string? | YYYY-MM-DD |
| `licGas` | string? | |
| `authUid` | string? | Firebase Auth UID |
| `createdAt` | Timestamp? | |
| `updatedAt` | Timestamp? | |
| `createdBy` | string? | |

---

### `costCodes`

| Field | Type | Notes |
|---|---|---|
| `code` | string | e.g. "GW", "RI", "TRM" |
| `label` | string | Display name |
| `sortOrder` | number | |

Auto-seeded with 12 default codes on first empty load (managed at `/settings`).

---

### `files`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Original filename |
| `storagePath` | string | Firebase Storage path |
| `downloadUrl` | string | Public download URL |
| `size` | number | Bytes |
| `contentType` | string | MIME type |
| `entityType` | string | job \| employee \| other |
| `entityId` | string | ID of the parent job/employee |
| `entityName` | string? | Denormalized |
| `category` | string? | File category for jobs (see `JobFileCategory`) |
| `uploadedBy` | string | Auth UID |
| `uploadedAt` | Timestamp | |

---

### `estimates`
Covers both **install** (service) and **construction** estimate types.

| Field | Type | Notes |
|---|---|---|
| `jobId` | string? | FK → `Jobs` |
| `jobName` | string | |
| `jobNumber` | string? | |
| `gcId` | string? | FK → `companies` |
| `gcName` | string? | Denormalized |
| `estimatorId` | string? | FK → `contacts` |
| `estimatorName` | string? | Denormalized |
| `status` | string | Draft \| Opportunity \| Awarded \| Lost |
| `type` | string? | "install" \| "construction" |
| `laborRate` | number | $/hr billing rate |
| `laborBurden` | number | $/hr cost (COGS) |
| `materialMarkup` | number | Percentage |
| `bidName` | string? | e.g. "Base Bid", "Alternate Add 1" |
| `notes` | string? | |
| `scopeOfWork` | string? | |
| `exclusions` | string? | |
| `clarifications` | string? | |
| `selectedExclusions` | string[]? | IDs from `exclusionLibrary` |
| `totalHours` | number | Rollup |
| `totalLaborBilling` | number | Rollup |
| `totalMaterialCost` | number | Rollup |
| `totalContractValue` | number | Rollup |
| `profitMargin` | number | Percentage |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

---

### `estimateLines`
Line items for install (service) estimates. One doc per line.

| Field | Type | Notes |
|---|---|---|
| `estimateId` | string | FK → `estimates` |
| `costCode` | string | FK → `costCodes` |
| `description` | string | |
| `laborHours` | number | |
| `materialCost` | number | |
| `sortOrder` | number | |
| `createdAt` | Timestamp | |

---

### `changeOrders`

| Field | Type | Notes |
|---|---|---|
| `coNumber` | string | Auto-generated: CO-01, CO-02 … (by Cloud Function) |
| `jobId` | string | FK → `Jobs` |
| `jobNumber` | string | |
| `jobName` | string | Denormalized |
| `subject` | string | |
| `description` | string | |
| `category` | string | Owner Change \| Field Condition \| Design Error \| Code Requirement \| Other |
| `laborHours` | number | |
| `materialCost` | number | |
| `equipmentCost` | number | |
| `subcontractorCost` | number | |
| `otherCost` | number | |
| `laborBurden` | number | $/hr cost |
| `laborBillingRate` | number | $/hr billing |
| `materialMarkup` | number | % |
| `subMarkup` | number | % |
| `laborCost` | number | Computed |
| `laborBilling` | number | Computed |
| `laborMarkedUp` | number | Computed |
| `materialMarkedUp` | number | Computed |
| `subMarkedUp` | number | Computed |
| `amountRequested` | number | |
| `amountApproved` | number | |
| `status` | string | Draft \| Submitted \| Under Review \| Approved \| Rejected \| Executed \| Billed |
| `submittedAt` | Timestamp? | |
| `underReviewAt` | Timestamp? | |
| `approvedAt` | Timestamp? | |
| `rejectedAt` | Timestamp? | |
| `requestedBy` | string | Auth UID |
| `requestedByName` | string | |
| `approvedBy` | string? | Auth UID |
| `approvedByName` | string? | |
| `approvalDocUrl` | string? | |
| `supportingDocs` | string[] | |
| `internalNotes` | string? | |
| `clientNotes` | string? | |
| `rejectionReason` | string? | |
| `billedOnInvoiceId` | string? | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

---

### `costingPhases`
Budget tracking — one doc per phase per job. Written by BudgetImport and ConstructionEstimateBuilder (on award).

| Field | Type | Notes |
|---|---|---|
| `jobId` | string | FK → `Jobs` |
| `jobName` | string | Denormalized |
| `costCode` | string | |
| `label` | string | Phase label |
| `subgrouping` | string | CONTRACTED WORK \| CHANGE ORDER \| FIXTURE |
| `coId` | string? | FK → `changeOrders` (if CO phase) |
| `estimateId` | string? | FK → `estimates` |
| `bidName` | string? | e.g. "Base Bid" |
| `estMaterialCost` | number | |
| `estLaborCost` | number | |
| `estHours` | number | |
| `mMarkup` | number | % |
| `lMarkup` | number | % |
| `contractValue` | number | Stored: mCost×(1+mMarkup/100) + lCost×(1+lMarkup/100) |
| `actualMaterials` | number? | Updated inline in PM page |
| `actualHours` | number? | Updated inline in PM page |
| `completedPct` | number? | 0–100; drives billable calculation |
| `notes` | string? | HTML string from rich-text editor |
| `importedAt` | Timestamp | |
| `updatedAt` | Timestamp | |

---

### `constructionEstimatePhases`
Pre-award phases for construction estimates (not used for PM tracking).

| Field | Type | Notes |
|---|---|---|
| `estimateId` | string | FK → `estimates` |
| `costCode` | string | |
| `label` | string | |
| `estMaterialCost` | number | |
| `estLaborCost` | number | |
| `estHours` | number | |
| `mMarkup` | number | % |
| `lMarkup` | number | % |
| `contractValue` | number | |
| `sortOrder` | number | |
| `importedAt` | Timestamp | |

---

### `constructionFixtures`
Pre-award fixture schedule imported from FastPipe (lives on the estimate, not the job).

| Field | Type | Notes |
|---|---|---|
| `estimateId` | string | FK → `estimates` |
| `costCode` | string | Mapped from materialGroup |
| `materialGroup` | string | Original FastPipe code (e.g. "02-EQG") |
| `quantity` | number | |
| `size` | string \| null | |
| `description` | string | |
| `sortOrder` | number | |
| `manufacturer` | string \| null | FastPipe col 5 (v2 format) |
| `model` | string \| null | FastPipe col 6 (v2 format) |
| `budgetUnitPrice` | number \| null | FastPipe col 7 (v2 format) |

---

### `jobFixtures`
Post-award fixture management. Copied from `constructionFixtures` when estimate is marked Awarded.

| Field | Type | Notes |
|---|---|---|
| `jobId` | string | FK → `Jobs` |
| `jobName` | string | Denormalized |
| `estimateId` | string | FK → `estimates` |
| `materialGroup` | string | Original FastPipe code |
| `costCode` | string | Mapped phase code |
| `sortOrder` | number | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |
| `description` | string | |
| `quantity` | number | |
| `size` | string \| null | |
| `manufacturer` | string \| null | |
| `model` | string \| null | |
| `budgetUnitPrice` | number \| null | From FastPipe estimate |
| `vendor` | string \| null | User-entered post-award |
| `actualUnitPrice` | number \| null | User-entered after sourcing |
| `dateNeededBy` | Timestamp \| null | |
| `dateOrdered` | Timestamp \| null | |
| `eta` | Timestamp \| null | |
| `dateDelivered` | Timestamp \| null | |
| `poNumber` | string \| null | |
| `notes` | string \| null | |
| `webLink` | string \| null | |
| `specSheetUrl` | string \| null | Auto-populated from `specSheetLibrary` at award |
| `attachments` | string[] | Storage download URLs (max 3) |
| `procurementStatus` | string | Unspecified \| Ordered \| In Transit \| Backordered \| On-Site \| Installed |
| `submittalStatus` | string | Not Submitted \| Submitted \| Approved \| Revise & Resubmit |

---

### `exclusionLibrary`
Standard exclusions used in estimate/proposal documents.

| Field | Type | Notes |
|---|---|---|
| `text` | string | Exclusion statement |
| `sortOrder` | number | Display order |
| `active` | boolean | |
| `createdAt` | Timestamp? | |

Auto-seeded with default Parker exclusions on first load.

---

### `specSheetLibrary`
Global spec sheet lookup keyed by manufacturer + model. Written by `FixtureDetailDrawer` when a user uploads a PDF.

| Field | Type | Notes |
|---|---|---|
| `manufacturerKey` | string | `manufacturer.toLowerCase()` |
| `modelKey` | string | `model.toLowerCase()` |
| `manufacturer` | string | Display form |
| `model` | string | Display form |
| `url` | string | Firebase Storage download URL |
| `uploadedBy` | string | Auth UID |
| `uploadedAt` | Timestamp | |

Document ID: `{manufacturerKey}__{modelKey}`

---

## 2. Pages & Routes

### `/` — Root Redirect
**File:** `src/app/page.tsx` · client
Checks Firebase Auth state; redirects to `/dashboard` if signed in, `/login` if not.

---

### `/login`
**File:** `src/app/login/page.tsx` · client
Google OAuth + email/password sign-in. Error handling for wrong-domain, wrong-password, etc. Redirects to `/dashboard` on success.

---

### `/dashboard`
**File:** `src/app/dashboard/page.tsx` · client
Collections: `Jobs`, `changeOrders`
Stats cards: active jobs count, pending CO count, total approved CO value. Module quick-access cards (Jobs, Change Orders, Purchase Orders, Files). Quick actions: New Job, New CO, Airtable Import.

---

### `/jobs`
**File:** `src/app/jobs/page.tsx` · client
Collections: `Jobs`
Full job list. Phase filter tabs (All, Lead, Bidding, Opportunity, Awarded, Active, Install, Warranty, Closed, Lost). Text search by name/GC/city. Parcel #, Bid Due Date, Contract Value display. Edit/delete per row. Link to create new job.

---

### `/jobs/new`
**File:** `src/app/jobs/new/page.tsx` · client
Thin wrapper rendering `JobForm` for creation.

---

### `/jobs/[id]`
**File:** `src/app/jobs/[id]/page.tsx` · client
Collections: `Jobs`, `Jobs/{id}/activity`, `costingPhases`, `files`
Full job detail: contract info, site address, team contacts (with modal popup), activity log (with tag filter + rich-text entry), file uploads (tabbed by category/phase), budget section (Awarded/Active/Install only) with total contract value + billable amount, budget import modal, fixtures link, PM link.

---

### `/jobs/[id]/edit`
**File:** `src/app/jobs/[id]/edit/page.tsx` · client
Thin wrapper rendering `JobForm` prefilled for editing.

---

### `/jobs/[id]/fixtures`
**File:** `src/app/jobs/[id]/fixtures/page.tsx` · client
Collections: `Jobs`, `jobFixtures`
Fixtures & Equipment management page. Category tabs (All / Parker Fixture / Parker Equipment / By Others). Filter bar: search text, phase, procurement status, submittal status. Table with inline status dropdowns (optimistic update). `FixtureDetailDrawer` slide-over for editing. Export CSV button (disabled — coming soon).

---

### `/change-orders`
**File:** `src/app/change-orders/page.tsx` · client
Collections: `changeOrders`
Summary cards: total COs, pending review, approved, total approved value. Status filter, text search. Inline "Submit" button for Draft COs. `ChangeOrderReview` modal for approval/rejection.

---

### `/change-orders/new`
**File:** `src/app/change-orders/new/page.tsx` · client
Collections: `changeOrders`, `Jobs`
Office CO creation via `ChangeOrderForm`.

---

### `/change-orders/field/new`
**File:** `src/app/change-orders/field/new/page.tsx` · client
Collections: `changeOrders`
Simplified field CO form (`FieldChangeOrderForm`). No AppShell — designed for field use on mobile.

---

### `/project-management`
**File:** `src/app/project-management/page.tsx` · client
Collections: `Jobs`, `costingPhases`
Global PM view. Collapsible cards per Awarded/Active/Install job. Each card shows costing phases grouped by subgrouping (Contracted Work / Change Orders), with inline editing of actual materials ($), actual hours, and completion %. Phase filter (Both/Awarded/Active/Install). Collapse All / Expand All. Rich-text notes per phase (Bold, Italic, Lists, Checkboxes). Hours remaining and billable amount calculated in real time. Multi-bid: when multiple `bidName` values exist for a job, Contracted Work shows per-bid subheaders.

---

### `/estimates`
**File:** `src/app/estimates/page.tsx` · client
Collections: `estimates`
Estimate list. Status filter (Draft, Opportunity, Awarded, Lost). Type badge (Install / Construction). Margin display with color coding (green ≥30%, amber ≥15%, red <15%). Bid Name shown next to job name when set. Type dropdown: "+ New Install Estimate" / "+ New Construction Estimate".

---

### `/estimates/new`
**File:** `src/app/estimates/new/page.tsx` · client
Thin wrapper rendering `EstimateBuilder` for a new install estimate.

---

### `/estimates/[id]`
**File:** `src/app/estimates/[id]/page.tsx` · client
Thin wrapper rendering `EstimateBuilder` with `estimateId` prop for editing.

---

### `/estimates/construction/new`
**File:** `src/app/estimates/construction/new/page.tsx` · server component
Thin wrapper rendering `ConstructionEstimateBuilder` for a new construction estimate.

---

### `/estimates/construction/[id]`
**File:** `src/app/estimates/construction/[id]/page.tsx` · client
Thin wrapper rendering `ConstructionEstimateBuilder` with `estimateId` prop.

---

### `/contacts`
**File:** `src/app/contacts/page.tsx` · client
Collections: `contacts`
Contact list. Search by name/company/title/email. Phone links. Delete with inline confirmation. Link to create new.

---

### `/contacts/new`
**File:** `src/app/contacts/new/page.tsx` · client
`ContactForm` for creation.

---

### `/contacts/[id]`
**File:** `src/app/contacts/[id]/page.tsx` · client
Contact detail view.

---

### `/contacts/[id]/edit`
**File:** `src/app/contacts/[id]/edit/page.tsx` · client
`ContactForm` prefilled for editing.

---

### `/companies`
**File:** `src/app/companies/page.tsx` · client
Collections: `companies`
Company list. Type filter tabs (All, GC, Sub, Vendor, Owner, Other). Tag filter buttons. Search. Inline type editing (click → dropdown). Inline tag add/remove. Delete with inline confirmation.

---

### `/companies/new`
**File:** `src/app/companies/new/page.tsx` · client
`CompanyForm` for creation.

---

### `/companies/[id]`
**File:** `src/app/companies/[id]/page.tsx` · client
Company detail view.

---

### `/companies/[id]/edit`
**File:** `src/app/companies/[id]/edit/page.tsx` · client
`CompanyForm` prefilled for editing.

---

### `/employees`
**File:** `src/app/employees/page.tsx` · client
Collections: `employees`
Employee list. Role filter tabs. Search. Hire date, status, phone display.

---

### `/employees/new`
**File:** `src/app/employees/new/page.tsx` · client
`EmployeeForm` for creation.

---

### `/employees/[id]`
**File:** `src/app/employees/[id]/page.tsx` · client
Employee detail view.

---

### `/employees/[id]/edit`
**File:** `src/app/employees/[id]/edit/page.tsx` · client
`EmployeeForm` prefilled for editing.

---

### `/jurisdictions`
**File:** `src/app/jurisdictions/page.tsx` · client
Collections: `jurisdictions`
Jurisdiction list with search.

---

### `/jurisdictions/new`
**File:** `src/app/jurisdictions/new/page.tsx` · client
`JurisdictionForm` for creation.

---

### `/jurisdictions/[id]`
**File:** `src/app/jurisdictions/[id]/page.tsx` · client
Jurisdiction detail.

---

### `/jurisdictions/[id]/edit`
**File:** `src/app/jurisdictions/[id]/edit/page.tsx` · client
`JurisdictionForm` prefilled for editing.

---

### `/files`
**File:** `src/app/files/page.tsx` · client
Collections: `files`, Firebase Storage
Global file browser. Entity filter tabs (All, Jobs, Employees, Other). Search. File thumbnails, size, upload date. Download links. Delete capability.

---

### `/settings`
**File:** `src/app/settings/page.tsx` · client
Collections: `costCodes`
Cost code CRUD: inline editing (click to edit), up/down reordering, delete with confirmation. Auto-seeds 12 default codes on first empty load. Link to Exclusion Library.

---

### `/settings/exclusions`
**File:** `src/app/settings/exclusions/page.tsx` · client
Collections: `exclusionLibrary`
Exclusion Library CRUD. Inline text editing (click → input). Up/down reordering. Delete with confirmation. Auto-seeds default Parker exclusions on first empty load.

---

### `/import`
**File:** `src/app/import/page.tsx` · client
Collections: `Jobs`, `companies`, `contacts`, `jurisdictions`, `employees`
One-time Airtable data migration utility. Hardcoded dataset: 13 jobs, 275 companies, 582 contacts, 28 jurisdictions, 8 employees. Button-triggered batch write. Not linked from navigation — accessed directly.

---

### `/admin/cleanup-fixture-phases`
**File:** `src/app/admin/cleanup-fixture-phases/page.tsx` · client
Collections: `costingPhases`
Admin utility that finds and deletes `costingPhases` docs with `subgrouping === "FIXTURE"` (a legacy data artifact). No AppShell. Not linked from navigation.

---

## 3. Components

### `AppShell.tsx`
Main layout shell. Wraps all authenticated pages. Renders sidebar nav, handles auth state (redirects to `/login` if unauthenticated), displays user email, sign-out button.
**Props:** `{ children: React.ReactNode }`

---

### `JobForm.tsx`
Create/edit job form. All job fields: name, phase, GC picker (`CompanyPicker`), site address, jurisdiction, contract values, bid due date, parcel #, team members (estimator, PM, superintendent — each via `ContactPicker`). Phase-conditional fields (Bid Due Date shown for Lead/Bidding; Parcel # for Awarded+).
**Props:** `{ job?: Job; createdBy: string }`

---

### `EstimateBuilder.tsx`
Full-featured install/service estimate builder. Lazy creates `estimates` doc on first "Add Line". Manages `estimateLines` (add/edit/delete/reorder). Labor rate, burden, material markup controls. Job picker, company picker, estimator picker. Status transitions: Draft → Opportunity → Awarded → Lost. Award flow: creates new job or links to existing job (with multi-bid support via `bidName`). Writes to `costingPhases` on award. Margin calculation. QBO export. Copy to clipboard. Scope of Work, Exclusions (from `exclusionLibrary`), Clarifications tabs.
**Props:** `{ estimateId?: string }`

---

### `ConstructionEstimateBuilder.tsx`
Construction estimate builder. Budget TSV import (from Parker's costing spreadsheet) → `constructionEstimatePhases`. FastPipe fixture TSV import (4-col legacy or 7-col v2) → `constructionFixtures`. Preview tables with add/delete. Exclusions checklist from `exclusionLibrary`. Mark Opportunity / Mark Awarded flows (same multi-bid logic as EstimateBuilder). On award: writes `costingPhases` tagged with `estimateId` + `bidName`, and copies fixture schedule to `jobFixtures` (full v2 schema with spec sheet lookup from `specSheetLibrary`).
**Props:** `{ estimateId?: string }`

---

### `BudgetImport.tsx`
Modal for re-importing budget TSV into an existing job's `costingPhases`. Shows diff preview (new vs existing phases). Supports cost code label remapping from Firestore `costCodes`.
**Props:** `{ jobId: string; jobName: string; existingPhases: CostingPhase[]; onClose: () => void }`

---

### `ChangeOrderForm.tsx`
Office change order creation. Job picker. Cost inputs: labor hours, material cost, equipment cost, subcontractor cost, other cost. Category selection. Labor rate / material markup with auto-suggest tiers. Description enhancement. Full cost computation (laborBilling, markups, amountRequested). Zod schema validation.
**Props:** `{ onSuccess?: () => void; onCancel?: () => void }`

---

### `FieldChangeOrderForm.tsx`
Simplified CO form for field use. No AppShell. Designed for mobile. Creates `changeOrders` doc in Draft status.

---

### `ChangeOrderReview.tsx`
Modal for reviewing a change order. Shows all cost details. Allows editing labor rate + material markup. Approve (sets `amountApproved`, status → Approved). Reject (requires rejection reason, status → Rejected). Delete (with confirmation). Status-based button visibility.
**Props:** `{ coId: string; onClose?: () => void }`

---

### `ContactForm.tsx`
Create/edit contact. First name, last name, title, company (`CompanyPicker`), phone (formatted), email.
**Props:** `{ contact?: Contact; createdBy: string }`

---

### `ContactPicker.tsx`
Single-select typeahead for choosing a contact. Used in `JobForm` for team member assignment.

---

### `ContactMultiPicker.tsx`
Multi-select typeahead for contacts. Used in `JurisdictionForm`.

---

### `ContactDetailModal.tsx`
Read-only modal showing contact details (name, title, company, phone, email). Triggered from team member display in job detail.
**Props:** `{ contactId: string | null; onClose: () => void }`

---

### `CompanyForm.tsx`
Create/edit company. Name, type dropdown, phone, email, address, city, state, zip, website, tags.
**Props:** `{ company?: Company; createdBy: string }`

---

### `CompanyPicker.tsx`
Single-select typeahead for choosing a company. Used in `ContactForm`, `JobForm`, `ChangeOrderForm`.

---

### `EmployeeForm.tsx`
Create/edit employee. All fields including licenses, emergency contacts, partner info.
**Props:** `{ employee?: Employee; createdBy: string }`

---

### `JurisdictionForm.tsx`
Create/edit jurisdiction. Name, state, phone numbers, address, website, notes, contacts.
**Props:** `{ jurisdiction?: Jurisdiction; createdBy: string }`

---

### `FileUpload.tsx`
Upload files to Firebase Storage + write metadata to `files` collection. Drag-and-drop + click. Progress bar. Category selection.
**Props:** `{ entityType; entityId; entityName; category; label }`

---

### `FileList.tsx`
Display files for a given entity + category. Download links. Delete (removes from Storage and `files` collection).
**Props:** `{ entityType; entityId; entityName; category }`

---

### `FileThumbnail.tsx`
Renders an image thumbnail or file-type icon for a `AppFile`.
**Props:** `{ file: AppFile; className?: string }`

---

### `fixtures/FixtureDetailDrawer.tsx`
Right-side slide-over drawer (620px) for editing `jobFixtures` fields post-award. Sections: Status (procurement + submittal selects), Sourcing (vendor, actual unit price, PO number, web link), Dates (needed by, ordered, ETA, delivered), Notes, Spec Sheet (upload → Firebase Storage + `specSheetLibrary` write), Attachments (upload → `arrayUnion`, max 3), Item Details (collapsible read-only). Dirty-state guard on close. Save writes full field set + `updatedAt`.
**Props:** `{ fixture: JobFixture | null; onClose: () => void }`

---

### `FirestoreStatus.tsx`
Debug/connection check component. Not linked from any page.

---

## 4. TypeScript Interfaces & Types

### `src/types/jobs.ts`

```typescript
type ProjectPhase = "Lead" | "Bidding" | "Opportunity" | "Awarded" | "Active"
                  | "Install" | "Warranty" | "Closed" | "Lost"

type ActivityTag = "General" | "Bidding" | "Sales" | "PM" | "Field"

interface Job {
  id: string
  jobName: string
  projectPhase: ProjectPhase
  gcName?: string
  gcId?: string
  siteAddress?: string; siteCity?: string; siteState?: string; siteZip?: string
  estimatorId?: string; estimatorName?: string
  pmId?: string; pmName?: string
  superintendentId?: string; superintendentName?: string
  jurisdictionId?: string; jurisdictionName?: string
  originalContractValue?: number
  currentContractValue?: number
  parcelNumber?: string
  bidDueDate?: Timestamp | null
  submittedDate?: Timestamp | null
  startDate?: Timestamp | null
  completionDate?: Timestamp | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
  createdBy?: string
}

interface ActivityEntry {
  id: string
  text: string
  createdAt: Timestamp | null
  createdBy: string
  createdByName: string
  tag: ActivityTag
}

// Constants:
ACTIVITY_TAGS: ActivityTag[]
PHASE_BADGE_CLASS: Record<ProjectPhase, string>  // Tailwind color classes
```

---

### `src/types/companies.ts`

```typescript
type CompanyType = "GC" | "Sub" | "Vendor" | "Owner" | "Other"

interface Company {
  id: string; name: string; type: CompanyType
  phone?: string; email?: string
  address?: string; city?: string; state?: string; zip?: string; website?: string
  tags?: string[]
  createdAt?: Timestamp | null; updatedAt?: Timestamp | null; createdBy?: string
}

interface Contact {
  id: string; firstName: string; lastName: string
  companyId?: string; companyName?: string; title?: string
  phone?: string; email?: string
  createdAt?: Timestamp | null; updatedAt?: Timestamp | null; createdBy?: string
}

function contactDisplayName(c): string
```

---

### `src/types/employees.ts`

```typescript
type EmployeeRole = "Owner" | "Journeyman" | "Apprentice" | "Admin" | "BookKeeper"
type EmployeeStatus = "Employed" | "Terminated"

interface Employee {
  id: string; firstName: string; lastName: string
  role?: string; status?: string
  phone?: string; email?: string; emailPersonal?: string; homeAddress?: string
  deviceNumber?: string
  partnerName?: string; partnerPhone?: string; partnerEmail?: string
  emergencyContact1?: string; emergency1Phone?: string
  emergencyContact2?: string; emergency2Phone?: string
  birthday?: string          // YYYY-MM-DD
  hireDate?: string          // YYYY-MM-DD
  licenseId?: string
  licPlumbing?: string; expPlumbing?: string
  licScissorLift?: string; expGas?: string; licGas?: string
  authUid?: string
  createdAt?: Timestamp | null; updatedAt?: Timestamp | null; createdBy?: string
}

function employeeDisplayName(e): string
```

---

### `src/types/jurisdictions.ts`

```typescript
interface Jurisdiction {
  id: string; name: string; state?: string
  phone?: string; inspectionPhone?: string
  address?: string; website?: string; notes?: string
  contactIds?: string[]; contactNames?: string
  createdAt?: Timestamp | null; updatedAt?: Timestamp | null; createdBy?: string
}
```

---

### `src/types/costCodes.ts`

```typescript
interface CostCode {
  id: string; code: string; label: string; sortOrder: number
}
```

---

### `src/types/files.ts`

```typescript
type FileEntity = "job" | "employee" | "other"

type JobFileCategory =
  | "Schedule" | "Workbook" | "Contract/Bid" | "Permits" | "Bid Plans"
  | "Active Plans" | "Health Plans" | "Fix/Equip (Others)" | "Fix/Equip (PS)"
  | "COI Doc" | "Site Safety Doc" | "Lien Intent" | "Pictures" | "Close Out Docs"

type JobFilePhase = "Bidding" | "Awarded" | "Active" | "Close out"

interface AppFile {
  id: string; name: string; storagePath: string; downloadUrl: string
  size: number; contentType: string
  entityType: FileEntity; entityId: string; entityName?: string
  category?: string; uploadedBy: string; uploadedAt: Timestamp
}

function formatBytes(bytes: number): string
function defaultFilePhaseForJob(projectPhase: string): JobFilePhase
```

---

### `src/types/estimates.ts`

```typescript
interface ServiceEstimate {
  id: string
  jobId?: string; jobName: string; jobNumber?: string
  gcId?: string; gcName?: string
  estimatorId?: string; estimatorName?: string
  status: "Draft" | "Opportunity" | "Awarded" | "Lost"
  type?: "install" | "construction"
  laborRate: number; laborBurden: number; materialMarkup: number
  bidName?: string | null
  notes?: string; scopeOfWork?: string; exclusions?: string; clarifications?: string
  selectedExclusions?: string[]
  totalHours: number; totalLaborBilling: number
  totalMaterialCost: number; totalContractValue: number; profitMargin: number
  createdAt: Timestamp; updatedAt: Timestamp
}

interface EstimateLine {
  id: string; estimateId: string; costCode: string
  description: string; laborHours: number; materialCost: number
  sortOrder: number; createdAt: Timestamp
}

function calcProfitMargin(totalHours, totalLaborBilling, totalMaterialCost, laborBurden, materialMarkup): number
function calcEstimateRollup(lines, laborRate, laborBurden, materialMarkup): Partial<ServiceEstimate>
```

---

### `src/types/costing.ts`

```typescript
interface CostingPhase {
  id: string; jobId: string; jobName: string
  costCode: string; label: string
  subgrouping: "CONTRACTED WORK" | "CHANGE ORDER" | "FIXTURE"
  coId?: string; estimateId?: string; bidName?: string
  estMaterialCost: number; estLaborCost: number; estHours: number
  mMarkup: number; lMarkup: number; contractValue: number
  actualMaterials?: number; actualHours?: number; completedPct?: number
  notes?: string
  importedAt: Timestamp; updatedAt: Timestamp
}

interface ParsedPhaseRow {
  costCode: string; label: string
  estMaterialCost: number; estLaborCost: number; estHours: number
  mMarkup: number; lMarkup: number; contractValue: number
}

function calcContractValue(mCost, lCost, mMarkup, lMarkup): number
function calcBillable(contractValue, pct?): number
function parseBudgetTSV(text, labelMap?): ParsedPhaseRow[]

// Constants:
COST_CODE_LABELS: Record<string, string>
```

---

### `src/types/changeOrders.ts`

```typescript
type COCategory = "Owner Change" | "Field Condition" | "Design Error"
                | "Code Requirement" | "Other"

type COStatus = "Draft" | "Submitted" | "Under Review" | "Approved"
              | "Rejected" | "Executed" | "Billed"

interface ChangeOrder {
  id: string; coNumber: string; jobId: string; jobNumber: string; jobName: string
  subject: string; description: string; category: COCategory
  laborHours: number; materialCost: number; equipmentCost: number
  subcontractorCost: number; otherCost: number
  laborBurden: number; laborBillingRate: number
  materialMarkup: number; subMarkup: number
  laborCost: number; laborBilling: number; laborMarkedUp: number
  materialMarkedUp: number; subMarkedUp: number
  amountRequested: number; amountApproved: number
  status: COStatus
  submittedAt?: Timestamp | null; underReviewAt?: Timestamp | null
  approvedAt?: Timestamp | null; rejectedAt?: Timestamp | null
  requestedBy: string; requestedByName: string
  approvedBy?: string; approvedByName?: string; approvalDocUrl?: string
  supportingDocs: string[]; internalNotes?: string; clientNotes?: string
  rejectionReason?: string; relatedInventoryItems?: string[]
  billedOnInvoiceId?: string
  createdAt: Timestamp | null; updatedAt: Timestamp | null
}

function suggestMaterialMarkup(materialCost: number): number
function suggestLaborRate(hours: number): number
```

---

### `src/types/exclusions.ts`

```typescript
interface Exclusion {
  id: string; text: string; sortOrder: number; active: boolean
  createdAt?: Timestamp | null
}

// Constants:
SEED_EXCLUSIONS: Omit<Exclusion, "id" | "createdAt">[]
```

---

### `src/types/constructionEstimate.ts`

```typescript
interface ConstructionEstimatePhase {
  id: string; estimateId: string; costCode: string; label: string
  estMaterialCost: number; estLaborCost: number; estHours: number
  mMarkup: number; lMarkup: number; contractValue: number
  sortOrder: number; importedAt: Timestamp
}

interface ConstructionFixture {
  id: string; estimateId: string
  costCode: string; materialGroup: string
  quantity: number; size: string | null; description: string
  sortOrder: number
  manufacturer: string | null
  model: string | null
  budgetUnitPrice: number | null
}

interface ParsedFastPipeRow {
  materialGroup: string; costCode: string
  quantity: number; size: string | null; description: string
  manufacturer: string | null; model: string | null; budgetUnitPrice: number | null
}

// Constants:
FASTPIPE_COST_CODE_MAP: Record<string, string>
// Maps: 01-FXT→TRM, 02-EQG→GW, 02-EQR→RI, 02-EQT→TRM, 03-FXG→GW,
//       03-FXR→RI, 03-FXT→TRM, 06-WH→WH, 07-GAS→GAS, 08-HVC→HVC,
//       09-M01→MISC01, 09-M02→MISC01, demo→MISC01

function calcConstructionRollup(phases): { totalContractValue, totalHours, totalMaterialCost, totalLaborCost }
function parseFastPipeTSV(text): ParsedFastPipeRow[]
// Handles 4-col legacy (MtlGroup|Qty|Size|Description)
// and 7-col v2 (MtlGroup|Qty|Size|Description...|Manufacturer|Model|UnitPrice)
// where description may contain embedded tabs → parse from right end
```

---

### `src/types/fixtures.ts`

```typescript
type ProcurementStatus = "Unspecified" | "Ordered" | "In Transit"
                       | "Backordered" | "On-Site" | "Installed"

type SubmittalStatus = "Not Submitted" | "Submitted" | "Approved" | "Revise & Resubmit"

type FixtureCategory = "Parker Fixture" | "Parker Equipment" | "By Others"

interface JobFixture {
  id: string; jobId: string; jobName: string; estimateId: string
  materialGroup: string; costCode: string; sortOrder: number
  createdAt: Timestamp; updatedAt: Timestamp
  description: string; quantity: number; size: string | null
  manufacturer: string | null; model: string | null; budgetUnitPrice: number | null
  vendor: string | null; actualUnitPrice: number | null
  dateNeededBy: Timestamp | null; dateOrdered: Timestamp | null
  eta: Timestamp | null; dateDelivered: Timestamp | null
  poNumber: string | null; notes: string | null; webLink: string | null
  specSheetUrl: string | null; attachments: string[]
  procurementStatus: ProcurementStatus; submittalStatus: SubmittalStatus
}

// Constants:
PARKER_FIXTURES: string[]    // ["01-FXT", "03-FXG", "03-FXR", "03-FXT"]
PARKER_EQUIPMENT: string[]   // ["02-EQG", "02-EQR", "02-EQT", "06-WH"]
PROCUREMENT_STATUSES: ProcurementStatus[]
SUBMITTAL_STATUSES: SubmittalStatus[]
PROCUREMENT_COLORS: Record<ProcurementStatus, string>  // Tailwind badge classes
SUBMITTAL_COLORS: Record<SubmittalStatus, string>
PHASE_BADGE_COLORS: Record<string, string>  // keyed by costCode

function getFixtureCategory(mg: string): FixtureCategory
function isParkerItem(mg: string): boolean
function getPhaseLabel(costCode: string): string
```

---

## 5. Cloud Functions

**Location:** `functions/src/changeOrders.ts`
**Runtime:** Firebase Functions v2, Node.js, Firebase Admin SDK

---

### `generateCONumber`
**Trigger:** `onDocumentCreated("changeOrders/{coId}")`
**Purpose:** Auto-assigns a sequential CO number when a new change order is written.
**Logic:**
1. Skips if `coNumber` is already set on the document.
2. Queries all `changeOrders` where `jobId` matches.
3. Generates `CO-${String(count + 1).padStart(2, "0")}` (e.g. `CO-01`, `CO-02`).
4. Updates the new document with the generated `coNumber`.

> **Note:** Client-side code also generates CO numbers with the same logic as a pre-write step. The Cloud Function is the authoritative fallback.

---

### `onCOStatusChange`
**Trigger:** `onDocumentUpdated("changeOrders/{coId}")`
**Purpose:** Increments the linked job's `currentContractValue` when a CO transitions to `Approved`.
**Logic:**
1. Checks that `status` changed from a non-Approved value **to** `"Approved"`.
2. Validates that `amountApproved` is a positive finite number.
3. Calls `FieldValue.increment(amountApproved)` on `Jobs/{jobId}.currentContractValue`.
4. Updates `Jobs/{jobId}.updatedAt`.

---

## 6. Firebase Storage Paths

| Path Pattern | Written By | Purpose |
|---|---|---|
| `files/jobs/{jobId}/{category}/{timestamp}_{filename}` | `FileUpload.tsx` | Job file attachments |
| `files/employees/{employeeId}/{timestamp}_{filename}` | `FileUpload.tsx` | Employee document files |
| `files/other/{timestamp}_{filename}` | `FileUpload.tsx` | General file storage |
| `specSheets/{jobId}/{fixtureId}.pdf` | `FixtureDetailDrawer.tsx` | Fixture spec sheets |
| `attachments/{jobId}/{fixtureId}/{filename}` | `FixtureDetailDrawer.tsx` | Fixture supporting attachments (max 3 per fixture) |

---

## 7. Navigation Structure

Defined in `AppShell.tsx`. Desktop sidebar, responsive (hamburger on mobile).

```
Dashboard                          /dashboard
Jobs ──────────────────────────── /jobs  [expandable submenu]
  ├─ All Jobs                      /jobs
  ├─ Project Management            /project-management
  ├─ Estimates                     /estimates
  └─ Change Orders                 /change-orders
Companies                          /companies
Contacts                           /contacts
Employees                          /employees
Jurisdictions                      /jurisdictions
Purchase Orders                    /pos  ← DISABLED ("Coming soon")
Files                              /files
Settings                           /settings
  └─ (sub-page) Exclusion Library  /settings/exclusions
```

**Not in sidebar (accessed via context links):**
- `/jobs/[id]/fixtures` — linked from job detail budget card header
- `/change-orders/field/new` — standalone field form
- `/estimates/construction/new` — from estimates list type dropdown
- `/admin/cleanup-fixture-phases` — direct URL only
- `/import` — direct URL only (linked from dashboard Quick Actions)

---

## 8. Build Status

### ✅ Complete — Production-ready

| Feature | Route(s) |
|---|---|
| Authentication (Google + email/password) | `/login`, `/` |
| Dashboard with live stats | `/dashboard` |
| Jobs CRUD + phase lifecycle | `/jobs`, `/jobs/new`, `/jobs/[id]`, `/jobs/[id]/edit` |
| Job detail: activity log, file attachments, budget section | `/jobs/[id]` |
| Fixtures & Equipment management | `/jobs/[id]/fixtures` |
| Change Orders (office + field) | `/change-orders`, `/change-orders/new`, `/change-orders/field/new` |
| CO approval workflow | Modal in `/change-orders` |
| Project Management (PM) — inline editing, notes, multi-bid | `/project-management` |
| Install/Service Estimates — full builder | `/estimates`, `/estimates/new`, `/estimates/[id]` |
| Construction Estimates — full builder | `/estimates/construction/new`, `/estimates/construction/[id]` |
| Budget import from TSV | `BudgetImport` modal in `/jobs/[id]` |
| Contacts CRUD | `/contacts`, `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit` |
| Companies CRUD + tags | `/companies`, `/companies/new`, `/companies/[id]`, `/companies/[id]/edit` |
| Employees CRUD + licenses | `/employees`, `/employees/new`, `/employees/[id]`, `/employees/[id]/edit` |
| Jurisdictions CRUD | `/jurisdictions`, `/jurisdictions/new`, `/jurisdictions/[id]`, `/jurisdictions/[id]/edit` |
| File storage (upload/download/delete) | `/files`, embedded in `/jobs/[id]`, `/employees/[id]` |
| Cost code management | `/settings` |
| Exclusion Library | `/settings/exclusions` |
| Cloud Functions: CO number generation + contract value increment | `functions/` |
| Spec sheet library (global lookup by manufacturer+model) | `specSheetLibrary` collection |
| Airtable one-time import | `/import` |
| Admin cleanup utility | `/admin/cleanup-fixture-phases` |

---

### ⚠️ Stubbed / Incomplete

| Feature | Status | Notes |
|---|---|---|
| **Purchase Orders** | ❌ Not built | Nav link disabled. No `/pos` page exists. Collection and types not defined. |
| **Fixture Export CSV** | 🔲 Stub | Button exists on `/jobs/[id]/fixtures` but is disabled with `title="Coming soon"`. |
| **Invoice/Billing tracking** | ❌ Not built | `billedOnInvoiceId` field exists on `changeOrders` but no invoice module. |
| **Warranty tracking** | 🔲 Phase exists | "Warranty" is a valid `projectPhase` but no dedicated warranty workflow or module. |

---

### 📐 Key Architectural Patterns

- All data subscriptions use `onSnapshot` for real-time updates.
- All writes use `serverTimestamp()` for `createdAt`/`updatedAt`.
- Optimistic UI: `setState` → `updateDoc` → revert on error (status selects, inline edits).
- Denormalization: job name, company name, estimator name stored on related docs to avoid joins.
- Date round-trip: Firestore `Timestamp` ↔ HTML `<input type="date">` ISO string via `Timestamp.fromDate(new Date(val))`.
- Card style: `rounded-xl border border-gray-200 bg-white shadow-sm`.
- Input style: `rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`.
- Rich-text notes: `contentEditable` div stored as HTML string in Firestore.
- Inline editing: click-to-edit pattern with Enter/blur to save, Escape to cancel.
