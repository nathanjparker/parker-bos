# Field Team UI Module — ARCHITECT.md

## Status
Prototype approved. Ready to build.

---

## Overview

A dedicated mobile-first interface for Parker Services field technicians. Field users log into the same app but are routed to `/field/*` based on their user role. They see only jobs in `Awarded` and `Active` projectPhase. No financial data is exposed — change orders show status only, no dollar amounts.

The field UI is completely separate from the office desktop experience. Different layout, different nav, dark theme, touch-optimized.

---

## Prototype Reference

The approved interactive prototype is saved as `parker-bos-field-prototype.jsx` in the project. Every component, layout, color, and interaction in that file is the visual spec. Match it exactly during build.

---

## Route Structure

All field routes live under `/field/*`. No AppShell (office sidebar/header) is rendered on these routes.

```
/field                          → Redirect to /field/jobs
/field/jobs                     → Job list (home screen)
/field/jobs/[id]                → Job detail view
/field/dashboard                → Cross-job CO overview dashboard
/field/schedule                 → Calendar placeholder (future)
/field/forms/change-order/[jobId]    → Field CO form
/field/forms/generic/[formType]/[jobId] → Generic form (PO, inspection, etc.)
```

### Route Files to Create
```
src/app/field/layout.tsx                          → Field layout (dark theme, bottom nav, FAB, no AppShell)
src/app/field/page.tsx                            → Redirect to /field/jobs
src/app/field/jobs/page.tsx                       → Job list screen
src/app/field/jobs/[id]/page.tsx                  → Job detail screen
src/app/field/dashboard/page.tsx                  → Dashboard screen
src/app/field/schedule/page.tsx                   → Schedule placeholder
src/app/field/forms/change-order/[jobId]/page.tsx → Field CO form (migrate existing FieldChangeOrderForm)
src/app/field/forms/generic/[formType]/[jobId]/page.tsx → Generic form template
```

---

## Component Files to Create

```
src/components/field/FieldLayout.tsx        → Dark theme wrapper, bottom nav, FAB
src/components/field/BottomNav.tsx          → 4-tab bottom navigation (Jobs, Dashboard, Schedule, More)
src/components/field/FAB.tsx                → Floating action button + form menu overlay
src/components/field/JobCard.tsx            → Job list card (number, name, GC, address, pending CO badge)
src/components/field/JobPickerModal.tsx     → Bottom sheet job selector (when FAB used without job context)
src/components/field/StatusBadge.tsx        → Colored status pills (reusable)
src/components/field/PhoneButton.tsx        → Contact row with tap-to-call
src/components/field/Card.tsx               → Dark theme card wrapper
src/components/field/GenericFormScreen.tsx   → Template form for not-yet-built form types
```

---

## Role-Based Routing

### Middleware Redirect

Add to `src/middleware.ts` (create if it doesn't exist):

```typescript
// After Firebase auth check, if user role is 'field':
// - Redirect / → /field/jobs
// - Redirect /dashboard → /field/dashboard
// - Allow /field/* routes
// - Block /jobs, /estimates, /change-orders (office routes)

// If user role is 'admin' or 'office':
// - Normal routing (existing behavior)
// - Allow /field/* for debugging (admin can visit field view)
```

### User Role Check
The existing `users` collection has a `role` field. Add `'field'` as a valid role value if not already present.

```typescript
type UserRole = 'admin' | 'office' | 'field';
```

### Auth Context Update
The existing auth context (`useAuth` or similar) should expose the user's role. The field layout checks this to confirm the user has field access.

---

## Firebase Queries

### Job List — Field Users Only See Awarded + Active

```typescript
// In /field/jobs/page.tsx
const jobsQuery = query(
  collection(db, 'Jobs'),
  where('projectPhase', 'in', ['Awarded', 'Active']),
  orderBy('jobNumber', 'desc')
);
```

**Critical:** Collection is `'Jobs'` (capital J) — not `'jobs'`.

### Job Detail — Standard Document Fetch

```typescript
const jobDoc = await getDoc(doc(db, 'Jobs', jobId));
```

### Change Orders — Per Job, No Financial Data in UI

```typescript
const cosQuery = query(
  collection(db, 'changeOrders'),
  where('jobId', '==', jobId),
  orderBy('createdAt', 'desc')
);
```

**Display rule:** Field UI renders `coNumber`, `subject`, `status`, `createdAt` only. Never render `amountRequested`, `amountApproved`, or any cost fields. The data is in Firestore but the field components simply don't read those fields.

### Dashboard — All COs Across All Visible Jobs

```typescript
// Option A: Query all COs for jobs the user can see
// This requires knowing the jobIds first (from the jobs query above)
// Then: where('jobId', 'in', visibleJobIds) — limited to 30 by Firestore

// Option B: Query all COs, filter client-side by visible jobs
// Better for small dataset (<100 COs total)
```

Recommend Option B for now given Parker's scale.

---

## Phone Numbers — Denormalization Decision

**Decision: Denormalize phone numbers onto the Job document.**

Add these fields to the Job document when team members are assigned:

```typescript
// Add to Jobs collection schema
estimatorPhone?: string;
projectManagerPhone?: string;
siteSupervisorPhone?: string;
```

**Why:** Eliminates an extra Firestore read per job detail view. Field users hit job detail constantly — every extra query adds latency on mobile. The denormalized phone numbers update via Cloud Function when employee data changes (same pattern as name denormalization already in place).

### Cloud Function Addition

```typescript
// When employee phone changes, update all Jobs where they're assigned
// Trigger: onDocumentUpdated("employees/{employeeId}")
// Logic: Query Jobs where estimatorId/pmId/siteSuperId matches, update phone field
```

---

## Theme

Dark theme. All colors defined as CSS variables in the field layout. The prototype uses these exact values:

```css
:root {
  --field-bg: #0F1117;
  --field-surface: #1A1D27;
  --field-surface-alt: #222633;
  --field-border: #2A2E3B;
  --field-accent: #3B82F6;
  --field-accent-soft: rgba(59,130,246,0.12);
  --field-green: #22C55E;
  --field-green-soft: rgba(34,197,94,0.12);
  --field-yellow: #EAB308;
  --field-yellow-soft: rgba(234,179,8,0.12);
  --field-red: #EF4444;
  --field-red-soft: rgba(239,68,68,0.12);
  --field-orange: #F97316;
  --field-orange-soft: rgba(249,115,22,0.12);
  --field-text: #F1F3F7;
  --field-text-muted: #8B90A0;
  --field-text-dim: #585D6E;
}
```

**Important:** These are scoped to the field layout only. The office UI retains its existing light theme. Use Tailwind `dark:` variants or a data attribute on the field layout root to scope the dark theme.

---

## FAB (Floating Action Button) Behavior

The FAB is a blue "+" circle fixed to the bottom-right, above the nav bar. It is always visible on every field screen *except* when a form is actively open.

### Tap Behavior

1. **If inside a job detail** → FAB menu shows with job pre-filled in blue header ("FOR JOB: 25-003 · Cherry Street Farms"). Tapping a form goes directly to that form with job context.

2. **If NOT inside a job detail** (on jobs list, dashboard, schedule) → FAB menu shows with "You'll pick a job on the next step" message. Tapping a form opens the `JobPickerModal` bottom sheet first, then navigates to the form after job selection.

### Form List in FAB

All forms appear in the menu. All are tappable. Change Order routes to the full field CO form. All others route to the generic form template.

```typescript
const FIELD_FORMS = [
  { id: 'change-order', name: 'Change Order', icon: '📋', path: '/field/forms/change-order' },
  { id: 'po-request', name: 'PO Request', icon: '📦', path: '/field/forms/generic/po-request' },
  { id: 'inspection', name: 'Inspection Request', icon: '🔍', path: '/field/forms/generic/inspection' },
  { id: 'daily-report', name: 'Daily Report', icon: '📝', path: '/field/forms/generic/daily-report' },
  { id: 'accident', name: 'Accident / Incident', icon: '🚨', path: '/field/forms/generic/accident' },
  { id: 'time-off', name: 'Time Off Request', icon: '🗓️', path: '/field/forms/generic/time-off' },
  { id: 'material-receipt', name: 'Material Receipt', icon: '🧾', path: '/field/forms/generic/material-receipt' },
];
```

---

## Bottom Navigation

4 tabs, fixed to bottom of viewport:

| Tab | Icon | Route | Notes |
|-----|------|-------|-------|
| Jobs | Briefcase | `/field/jobs` | Default/home tab |
| Dashboard | Grid | `/field/dashboard` | CO overview across all jobs |
| Schedule | Calendar | `/field/schedule` | Placeholder for Calendar module |
| More | Dots | `/field/more` | Profile, notifications, directory, settings |

Tapping any tab clears the current job context and navigates to that section's root.

---

## Field Change Order Form

Migrate the existing `FieldChangeOrderForm` component to `/field/forms/change-order/[jobId]/page.tsx`. The form already exists and works — it just needs to be re-routed and styled with the dark theme.

### Existing Form Features to Preserve
- Description field with AI enhancement button (Claude Sonnet 4 via `/api/enhance-description`)
- Voice input button (Web Speech API)
- Labor hours estimate (field user's rough guess)
- Material cost estimate (field user's rough guess)
- Photo upload (camera + library)
- Submit creates `changeOrders` document with `status: 'Draft'` or `'Submitted'`
- No rate controls (office handles `laborBillingRate`, `materialMarkup`, etc.)

### Form Adjustments for Field UI
- Dark theme styling
- Job context pre-filled from route param `[jobId]`
- Back button returns to job detail, not change orders list
- Success screen with "Done" button (not "View Change Order")

---

## Generic Form Template

For forms that aren't fully built yet (PO Request, Inspection, Daily Report, etc.), use a generic form that:

1. Shows the form name, icon, and description
2. Has a freeform text field ("Details")
3. Has an attachment upload area
4. Submits to a `formSubmissions` collection in Firestore

```typescript
interface FormSubmission {
  id: string;
  formType: string; // 'po-request' | 'inspection' | 'daily-report' | etc.
  jobId: string;
  jobNumber: string;
  jobName: string;
  submittedBy: string; // auth UID
  submittedByName: string;
  details: string;
  attachments: string[]; // Firebase Storage URLs
  status: 'Submitted' | 'Reviewed';
  createdAt: Timestamp;
}
```

This way, even before each form module is built, submissions are captured and the office can see them. When a specific form module is built later (e.g., PO Request gets its own fields and workflow), swap the generic form route for the dedicated component.

---

## Firestore Security Rules Updates

Add field-specific rules:

```javascript
// Field users can read Jobs where projectPhase is Awarded or Active
// Field users can read changeOrders for visible jobs
// Field users can create changeOrders and formSubmissions
// Field users cannot read financial fields — enforced at UI level (Firestore doesn't support field-level security)
// Field users cannot delete anything
// Field users cannot modify job documents

function isFieldUser() {
  return isAuthenticated() && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'field';
}
```

**Note:** Firestore doesn't support field-level read restrictions. Financial data hiding is enforced at the UI/component level. The field components simply don't query or render those fields.

---

## Files Visibility

Field users see job files in Awarded and Active status. The existing file storage pattern (Firebase Storage URLs stored on job or subcollection) determines what's available. The field UI renders files as a list with PDF icons and open-in-new-tab links.

No file upload capability for field users in v1 (except via forms — CO photos, generic form attachments).

---

## Build Order

### Sprint 1: Foundation (Cursor Session 1)
1. Create `/field/*` route structure and layout
2. Build `FieldLayout.tsx` with dark theme, bottom nav
3. Build job list page with Firestore query (`projectPhase in ['Awarded', 'Active']`)
4. Build job detail page with contacts (tap-to-call) and address (tap-to-navigate)
5. Test with existing Firebase data

### Sprint 2: Change Orders + FAB (Cursor Session 2)
1. Build CO section in job detail (status only, no amounts)
2. Migrate `FieldChangeOrderForm` to new route with dark theme
3. Build FAB component with form menu
4. Build `JobPickerModal` for FAB without job context
5. Build dashboard page (cross-job CO overview)

### Sprint 3: Forms + Polish (Cursor Session 3)
1. Build generic form template
2. Create `formSubmissions` collection and write rules
3. Wire all form routes through FAB
4. Add phone number denormalization to Job documents
5. Add role-based redirect middleware
6. Build schedule placeholder and "More" section
7. Test end-to-end on mobile device

### Sprint 4: Security + Deploy (Cursor Session 4)
1. Update Firestore security rules
2. Add `'field'` role to user seeding script
3. Test role-based routing (field user → field UI, admin → office UI)
4. Test on actual phones (Josh's phone, David's phone)
5. Deploy to production

---

## Critical Rules

1. **Collection name is `'Jobs'`** (capital J) — not `'jobs'`. This has caused bugs before.
2. **No dollar amounts in field UI** — not on COs, not on dashboard, not anywhere. Status badges only.
3. **No AppShell on field routes** — the field layout is completely independent from the office layout.
4. **FAB always visible** except when a form is open.
5. **All forms are tappable at launch** — Change Order has its full form, everything else uses the generic template.
6. **Dark theme is field-only** — do not affect the office UI's existing light theme.
7. **Match the prototype exactly** — colors, spacing, border radii, font weights, everything. The prototype IS the spec.

---

## Open Questions (Resolve During Build)

- [ ] Should the "More" tab include a logout button, or handle that differently?
- [ ] Does Josh get any elevated view later? (Deferred — everyone gets same view at launch)
- [ ] Should `formSubmissions` trigger a notification to the office? (Nice to have, not launch blocker)
- [ ] How should the schedule tab connect to the Calendar module? (Depends on calendar ARCHITECT.md)

---

## Files Modified (Existing)

```
src/middleware.ts                    → Add role-based redirect logic
src/types/jobs.ts                   → Add estimatorPhone, pmPhone, siteSupPhone fields
src/components/ChangeOrderForm.tsx  → No changes (office form stays as-is)
firestore.rules                     → Add field user rules
```
