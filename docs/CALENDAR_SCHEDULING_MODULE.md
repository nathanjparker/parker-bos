# Calendar & Scheduling Module

## Status
**Designed — Ready to Build.** Full requirements gathered through two rounds of questionnaires with Brittany (Executive Assistant / Office) and strategic input from Nate (Owner). Josh (Field Lead) input pending on select UX questions but does not block architecture or core build.

---

## WARNING
Read this entire document before writing any code. This module touches `costingPhases` (existing collection), `employees` (existing collection), and introduces a new `sessions` subcollection pattern. Do NOT modify existing `costingPhases` fields — only ADD new fields. Do NOT modify the existing project management page inline editing behavior.

---

## 1 — CONTEXT & WHAT EXISTS TODAY

Parker BOS is a Next.js 14 + TypeScript + Firebase app. The project management page already displays `costingPhases` per job with inline editing of `actualMaterials`, `actualHours`, and `completedPct`. This module adds scheduling capability on top of that existing data.

### Existing Collections Referenced
- `costingPhases` — budget tracking, one doc per phase per job. Has `estHours`, `completedPct`, `actualHours`, `costCode`, `label`, `jobId`, `jobName`, `contractValue`, `subgrouping`, `bidName`
- `employees` — Parker staff with `firstName`, `lastName`, `fullName`, `role`, `status`, `phone`, `email`
- `Jobs` (capital J) — job records with `jobNumber`, `jobName`, `siteAddress`, `siteCity`, `siteState`, `siteZip`, `projectPhase`, `estimatorId`, `projectManagerId`, `siteSupervisorId` + denormalized names

### Do Not Touch
- The inline editing behavior on the PM page (`actualMaterials`, `actualHours`, `completedPct`)
- The `costingPhases` write logic in `ConstructionEstimateBuilder.tsx` or `BudgetImport`
- The existing AppShell navigation structure (we ADD items, not restructure)
- The `Jobs` collection schema (we ADD fields, not modify existing ones)
- Any fixture management, change order, or estimate module code

### What This Module Builds
1. **Sessions data model** — new fields on `costingPhases` + new `scheduleSessions` collection
2. **PM page calendar toggle** — slide panel for date entry alongside existing phase table
3. **Calendar page** — new sidebar nav item, monthly view across all jobs
4. **Field mobile view** — today + 3-day lookahead for crew members
5. **Capacity math** — remaining hours calculation, budget warnings
6. **Session completion** — voice-to-text notes with AI enhancement
7. **Time tracking bridge** — `ScheduledWork` interface for future module handshake

---

## 2 — BUSINESS CONTEXT FROM REQUIREMENTS GATHERING

### How Scheduling Works Today
- Dispatch calendar on Google Calendar + communication via text and Google Chat
- Josh and Brittany coordinate crew assignments
- Currently planned ~1 week out; goal is 2–3 weeks ahead calculated by hours per job bid
- Mid-day changes: crew calls Josh → Josh relays to Brittany → Brittany relays to owners in emergencies
- Phase tracking in Airtable + personal spreadsheet; not accurate enough
- GC provides master schedules via email, PDF, Procore, or verbally

### Crew Structure
- 4-person team: Josh, David, Jameson, Enrique. Occasionally 5 with owner (Nate)
- Natural pairs: Josh/David and Jameson/Enrique, but flexible
- Everyone cross-trained; skill level, availability, proximity, and continuity drive assignments
- Josh is field lead — knows every job, does walks, first call for changes
- No subcontractors or temporary labor
- Split days are common, especially for Josh (walks, material drops, check-ins)

### Key Requirements from Brittany
- Must track hours bid per phase, hours spent per phase, hours remaining per phase — accurately
- Tentative vs. confirmed sessions needed
- Track what's being waited on during gaps between sessions (inspection, materials, other trade)
- Brittany updates all scheduling info; needs real-time accuracy
- Finance needs phase-level hour breakdowns for billing (monthly on percent complete)
- Budget warnings at percentage thresholds (25% remaining, 10% remaining, 0%)
- Kristen (billing) needs phase completion alerts — she bills through QBO and notifies the GC
- Three office users: Brittany, Kristen, Sarah — all get full office access
- Color-coding helpful but must be simple and consistent
- Monthly calendar is the #1 priority view; day and year options also desired
- Drag-and-drop rescheduling: yes, wanted
- Gap finder for capacity planning: strong yes — directly affects revenue and scheduling speed
- Double-booking: warn, don't block
- Daily "tomorrow's schedule" notification to crew: yes
- Stalled job detection (3+ weeks no sessions): yes
- Non-phase work (site visits, meetings, warranty, mobilization) must appear on calendar

### Key Requirements from Nate/Josh
- No project phase filtering on calendar — if it's scheduled, field can see it
- Job walks and non-phase site visits are overhead (not billed to job costing)
- Field mobile view: today + 3-day lookahead toggle, clickable address for navigation, T&M progress reports, notes
- Session completion with voice-to-text + AI enhancement (reuse existing `/api/enhance-description` pattern)
- Prevailing wage jobs need rate classifications (journeyman, apprentice, foreman) on crew assignments
- Session visits per phase are highly variable — no defaults or templates

### Dependency Windows (Schedule Float)
Brittany described wanting to see: `Latest Acceptable Finish − Earliest Possible Start`
- **Earliest possible start**: when we CAN begin (e.g., tile grout has cured, inspection passed)
- **Latest acceptable finish**: when we MUST be done (e.g., before final building inspection, before drywall)
- This window shows how much scheduling flexibility exists per phase

---

## 3 — DATA MODEL

### New Fields on `costingPhases` (ADD only — do not modify existing fields)

```typescript
// ADD these fields to existing costingPhases documents
{
  // Dependency Window (Schedule Float)
  earliestStartDate?: Timestamp | null;    // "Can't start until..."
  latestFinishDate?: Timestamp | null;     // "Must be done before..."
  dependencyNote?: string | null;          // "Waiting on tile grout cure"

  // Budget Warning Thresholds (percentage-based)
  // Computed at display time, not stored:
  //   remainingHours = estHours * (1 - completedPct / 100)
  //   remainingPct = 100 - completedPct
  //   WARNING at 25% remaining, CRITICAL at 10% remaining, OVER at 0%
}
```

### New Collection: `scheduleSessions`

Top-level collection (not a subcollection). This keeps queries flexible — we need to query by job, by employee, and by date range across all jobs.

```typescript
interface ScheduleSession {
  id: string;

  // ========== JOB & PHASE LINK ==========
  jobId: string;
  jobNumber: string;           // Denormalized
  jobName: string;             // Denormalized
  costingPhaseId: string;      // FK → costingPhases doc ID
  costCode: string;            // GW, RI, TRM, WH, GAS, etc.
  phaseLabel: string;          // "Groundwork", "Rough-In", etc.

  // ========== SESSION TYPE ==========
  sessionType: 'phase-work' | 'site-visit' | 'coordination' |
               'warranty' | 'mobilization' | 'other';
  // phase-work: ties to costingPhase, affects capacity math
  // all others: overhead, visible on calendar but no costing impact

  // ========== DATES ==========
  startDate: Timestamp;        // First day of session
  endDate: Timestamp;          // Last day of session (inclusive)
  hoursPerDay: number;         // Default 8
  includesWeekend: boolean;    // Default false

  // ========== STATUS ==========
  status: 'tentative' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

  // ========== CREW ASSIGNMENT ==========
  assignedCrew: Array<{
    employeeId: string;        // FK → employees collection
    employeeName: string;      // Denormalized
    role?: 'journeyman' | 'apprentice' | 'foreman' | null; // For prevailing wage
    hoursPerDay?: number;      // Override session default if different
  }>;

  // ========== GAP TRACKING ==========
  // Set when session completes and there's a known wait before the next one
  gapInfo?: {
    waitingOn: 'inspection' | 'materials' | 'other-trade' |
               'GC-direction' | 'weather' | 'other';
    waitingNote?: string;      // Free text: "Waiting on east wing excavation"
    earliestReturnDate?: Timestamp | null;
  } | null;

  // ========== COMPLETION ==========
  completionNote?: string | null;  // AI-enhanced note from field
  completedAt?: Timestamp | null;
  completedBy?: string | null;     // employeeId who marked complete

  // ========== COMPUTED AT DISPLAY TIME (never stored) ==========
  // workingDays = business days between startDate and endDate
  //              + weekend days if includesWeekend
  // sessionCapacityHours = sum of (crew[i].hoursPerDay ?? hoursPerDay) * workingDays
  // phaseRemainingHours = costingPhase.estHours * (1 - costingPhase.completedPct / 100)

  // ========== METADATA ==========
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### Firestore Indexes Needed for `scheduleSessions`
```
- jobId + startDate (sessions for a job, ordered by date)
- assignedCrew (array-contains query by employeeId for "my schedule")
- startDate + endDate (date range queries for calendar view)
- status (filter active/completed/cancelled)
- costingPhaseId (all sessions for a specific phase)
```

**Note on array-contains:** Firestore `array-contains` works on the full object, not nested fields. For querying sessions by employee, we have two options:
1. Store a separate `assignedCrewIds: string[]` array field (flat list of just IDs) for querying
2. Use `array-contains` with the full crew object

**Recommended: Option 1** — add `assignedCrewIds` as a flat array for efficient querying:

```typescript
{
  // ... all fields above, plus:
  assignedCrewIds: string[];   // Flat array of employeeId values for querying
}
```

Index: `assignedCrewIds (array-contains) + startDate`

### Time Tracking Bridge Interface

This interface is defined NOW but not consumed until the time tracking module is built. It represents the "exploded" view of a session — one record per person per day.

```typescript
// src/types/scheduling.ts

export interface ScheduledWork {
  // Source reference
  sessionId: string;           // FK → scheduleSessions
  jobId: string;
  jobNumber: string;           // Denormalized
  jobName: string;             // Denormalized
  costCode: string;            // GW, RI, TRM, etc.
  phaseLabel: string;          // "Groundwork", "Rough-In", etc.

  // Assignment
  employeeId: string;
  employeeName: string;
  role?: 'journeyman' | 'apprentice' | 'foreman' | null;
  scheduledDate: Timestamp;    // Single day
  scheduledHours: number;

  // Time tracking will populate these later:
  // actualHours?: number;
  // confirmedBy?: string;
  // confirmedAt?: Timestamp;
  // variance?: number;       // scheduledHours - actualHours
  // status?: 'pending' | 'confirmed' | 'adjusted';
}

// Helper function — generates daily records from a session
export function explodeSessionToScheduledWork(
  session: ScheduleSession
): ScheduledWork[] {
  const records: ScheduledWork[] = [];
  const current = new Date(session.startDate.toDate());
  const end = new Date(session.endDate.toDate());

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Skip weekends unless session includes them
    if (!isWeekend || session.includesWeekend) {
      for (const crew of session.assignedCrew) {
        records.push({
          sessionId: session.id,
          jobId: session.jobId,
          jobNumber: session.jobNumber,
          jobName: session.jobName,
          costCode: session.costCode,
          phaseLabel: session.phaseLabel,
          employeeId: crew.employeeId,
          employeeName: crew.employeeName,
          role: crew.role ?? null,
          scheduledDate: Timestamp.fromDate(new Date(current)),
          scheduledHours: crew.hoursPerDay ?? session.hoursPerDay,
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return records;
}
```

### Lightweight Hour Logging (Interim Time Tracking Bridge)

Until the full time tracking module is built, sessions support simple hour logging so remaining-hours math stays accurate. This is a field on the session itself — NOT a separate collection.

```typescript
// On ScheduleSession — ADD these fields
{
  // Lightweight hour log (interim — replaced by time tracking module later)
  loggedHours?: number | null;   // Actual total hours worked across all crew this session
  // When set, this feeds back into capacity calculations
  // PM can also just update completedPct directly on costingPhases (existing behavior)
}
```

---

## 4 — PHASE LABEL MAPPING

Reuse the existing mapping from the fixture module:

```typescript
const PHASE_LABELS: Record<string, string> = {
  GW: 'Groundwork',
  RI: 'Rough-In',
  TRM: 'Trim',
  WH: 'Water Heater',
  GAS: 'Gas',
  HVC: 'HVAC',
  MISC01: 'Misc',
};

// Session type labels for non-phase work
const SESSION_TYPE_LABELS: Record<string, string> = {
  'phase-work': 'Phase Work',
  'site-visit': 'Site Visit',
  'coordination': 'Coordination',
  'warranty': 'Warranty',
  'mobilization': 'Mobilization',
  'other': 'Other',
};
```

---

## 5 — CAPACITY MATH (Computed at display time — never stored)

### Remaining Hours per Phase
```typescript
function getRemainingHours(phase: CostingPhase): number {
  return phase.estHours * (1 - (phase.completedPct ?? 0) / 100);
}
```

### Session Capacity
```typescript
function getSessionCapacity(session: ScheduleSession): number {
  const start = session.startDate.toDate();
  const end = session.endDate.toDate();
  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend || session.includesWeekend) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Sum per-crew hours (use crew override or session default)
  const hoursPerDay = session.assignedCrew.reduce((sum, crew) => {
    return sum + (crew.hoursPerDay ?? session.hoursPerDay);
  }, 0);

  return hoursPerDay * workingDays;
}
```

### Capacity Status
```typescript
type CapacityStatus = 'sufficient' | 'short' | 'over';

function getCapacityStatus(
  sessionCapacity: number,
  remainingHours: number
): { status: CapacityStatus; difference: number } {
  const diff = sessionCapacity - remainingHours;
  if (diff >= 0) return { status: 'sufficient', difference: diff };
  if (diff >= -8) return { status: 'short', difference: diff };
  return { status: 'over', difference: diff };
}

// Display:
// sufficient (green):  "24 hrs capacity · 24 hrs remaining ✓"
// short (yellow):      "16 hrs capacity · 24 hrs remaining ⚠ 8 hrs short"
// over (red):          "8 hrs capacity · 24 hrs remaining ✗ 16 hrs short"
```

### Budget Warning Thresholds (percentage-based)
```typescript
type BudgetWarning = 'normal' | 'warning' | 'critical' | 'over-budget';

function getBudgetWarning(phase: CostingPhase): BudgetWarning {
  const remainingPct = 100 - (phase.completedPct ?? 0);
  const remainingHours = getRemainingHours(phase);

  // Over budget: actual hours exceed estimated hours
  if ((phase.actualHours ?? 0) > phase.estHours) return 'over-budget';
  // Note: completedPct can reach 100% before estHours are used
  // The real check is actualHours vs estHours when available

  if (remainingPct <= 0) return 'over-budget';
  if (remainingPct <= 10) return 'critical';
  if (remainingPct <= 25) return 'warning';
  return 'normal';
}

// Warning colors:
// normal:      no indicator
// warning:     yellow badge: "25% hours remaining"
// critical:    orange badge: "10% hours remaining"
// over-budget: red badge: "Over budget by X hours"
```

---

## 6 — CONFLICT DETECTION

### Double-Booking Check
When adding/editing a session, query `scheduleSessions` for each assigned crew member:

```typescript
async function checkCrewConflicts(
  session: Partial<ScheduleSession>,
  excludeSessionId?: string // For edits, exclude the session being edited
): Promise<Array<{ employeeId: string; employeeName: string; conflictingSession: ScheduleSession }>> {
  const conflicts = [];

  for (const crew of session.assignedCrew ?? []) {
    // Query: sessions where this employee is assigned AND dates overlap
    const q = query(
      collection(db, 'scheduleSessions'),
      where('assignedCrewIds', 'array-contains', crew.employeeId),
      where('status', 'in', ['tentative', 'confirmed', 'in-progress']),
      where('startDate', '<=', session.endDate),
      // Note: Firestore can't do startDate <= X AND endDate >= Y in one query
      // Fetch candidates by startDate <= session.endDate, then filter client-side
    );

    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      if (doc.id === excludeSessionId) continue;
      const existing = doc.data() as ScheduleSession;
      // Check overlap: existing.endDate >= session.startDate
      if (existing.endDate.toDate() >= session.startDate!.toDate()) {
        conflicts.push({
          employeeId: crew.employeeId,
          employeeName: crew.employeeName,
          conflictingSession: existing,
        });
      }
    }
  }
  return conflicts;
}
```

**Behavior:** WARN, do not block. Show yellow banner: "Josh is also scheduled at Henderson (Rough-In) on Tuesday." User can proceed or adjust.

---

## 7 — FILE PATHS

### Files to Create
```
src/types/scheduling.ts                          — ScheduleSession, ScheduledWork, helpers
src/app/calendar/page.tsx                        — Main calendar page (monthly view)
src/components/calendar/MonthlyCalendar.tsx       — Monthly calendar grid component
src/components/calendar/SessionCard.tsx           — Compact session display for calendar cells
src/components/calendar/SessionFormDrawer.tsx     — Create/edit session slide-in panel
src/components/calendar/FieldScheduleView.tsx     — Mobile: today + 3-day lookahead
src/components/calendar/CapacityBadge.tsx         — Green/yellow/red capacity indicator
src/components/calendar/GapFinderView.tsx         — Capacity gap analysis (Phase 2)
src/app/api/enhance-session-note/route.ts        — AI note enhancement (reuse pattern)
```

### Files to Modify
```
src/app/jobs/[id]/page.tsx                       — Add calendar toggle to PM page
src/components/AppShell.tsx                       — Add Calendar nav item to sidebar
```

### Files to Reference (read-only)
```
src/types/costing.ts                             — CostingPhase interface
src/types/employees.ts                           — Employee interface
src/types/jobs.ts                                — Job interface
src/app/api/enhance-description/route.ts         — Existing AI enhancement pattern to copy
```

---

## 8 — UI SPECIFICATIONS

### 8.1 — PM Page Calendar Toggle

**Trigger:** Calendar icon button in the PM page header, next to existing controls.

**Behavior:** When toggled ON:
- Phase table compresses to left ~55% of width, showing: phase label, status badge, completion %, session count
- Right ~45% slides in showing the session entry panel per phase
- Each phase row in the right panel shows:
  - Existing sessions as compact cards (dates, crew count, status badge)
  - "+ Add Session" button
  - Remaining hours badge
  - Dependency window dates if set (earliest start / latest finish)
  - Budget warning badge if applicable

**Behavior:** When toggled OFF:
- Returns to full-width existing PM page layout
- No data loss — sessions persist in Firestore

**Phase Dependency Fields** (shown in calendar toggle panel):
- Earliest Start Date — date picker
- Latest Finish Date — date picker
- Dependency Note — text input ("Waiting on tile grout cure")
- These write directly to the `costingPhases` document (new fields)

### 8.2 — Session Form Drawer (Create / Edit)

**Opens from:** PM page calendar toggle "+ Add Session" button, or clicking existing session card, or from the calendar page.

**Fields:**

| Field | Input Type | Default | Notes |
|-------|-----------|---------|-------|
| Job | Auto-populated | — | Read-only when opened from PM page |
| Phase | Dropdown | — | List of costingPhases for this job. Hidden for non-phase session types |
| Session Type | Dropdown | `phase-work` | phase-work, site-visit, coordination, warranty, mobilization, other |
| Start Date | Date picker | — | Required |
| End Date | Date picker | = Start Date | Required. Can equal start date for single-day sessions |
| Hours Per Day | Number | 8 | |
| Includes Weekend | Toggle | Off | |
| Status | Dropdown | `tentative` | tentative, confirmed |
| Assigned Crew | Multi-select | — | Dropdown of active employees from `employees` collection |
| Role (per crew member) | Dropdown | null | journeyman, apprentice, foreman. Only shown for prevailing wage jobs |
| Hours Override (per crew) | Number | null | Per-crew override, shown as small input next to crew member name |
| Note | Textarea | — | Free text |

**On Save:**
1. Validate: start date ≤ end date, at least one crew member assigned
2. Run conflict detection — show warning if conflicts found, do NOT block save
3. Build `assignedCrewIds` flat array from `assignedCrew`
4. Write to `scheduleSessions` collection
5. Close drawer, refresh calendar/PM view

**On Edit:**
- Pre-populate all fields from existing session
- Same validation + conflict detection

### 8.3 — Calendar Page (Sidebar Nav)

**Route:** `/calendar`
**Nav item:** Add "Calendar" to sidebar between "Project Management" and "Estimates" (or wherever feels natural in the existing nav hierarchy).

**Default view:** Monthly calendar, current month.

**Header controls:**
- Month/year navigation (< Month Year >)
- "Today" button to jump to current month
- View toggle: Month | Week (future: Gantt)
- Filter dropdown: All Jobs | specific job
- Filter dropdown: All Crew | specific employee ("By Person" view)

**Calendar grid:**
- 7 columns (Sun–Sat), weekends shown but visually muted (lighter background)
- Each day cell shows session cards stacked vertically
- Session card displays: job name (bold), phase label, crew initials or count, capacity badge (if phase-work)
- Tentative sessions shown with dashed border
- Color-coding: by job (each job gets a consistent color from a palette)
- Click session card → opens SessionFormDrawer for editing
- Click empty day area → opens SessionFormDrawer for new session on that date

**"By Person" filter:**
- When a specific employee is selected, calendar only shows sessions where that employee is assigned
- Shows their full schedule across all jobs
- Highlights days with no assignment (potential availability)

**Today/This Week Dashboard (top of calendar page):**
- Collapsible section above the calendar grid
- Shows today's sessions: who's where, what phase, capacity status
- Shows any budget warnings across active jobs
- Shows any stalled jobs (3+ weeks since last session)

### 8.4 — Field Mobile View

**Route:** Accessible from the job detail page (`/jobs/[id]`) AND from a dedicated field schedule view.

**Within Job Detail Page:**
- New "Schedule" section below Contacts and Address, above Change Orders
- Shows current/next session for this job
- Crew assigned, dates, phase, capacity status
- Session completion button (when session is in-progress or confirmed and date is today)

**Standalone Field Schedule View:**
- Toggle: "Today" | "3 Days"
- **Today view:** Shows all sessions where the current user (by `employeeId`) is assigned today
  - Job name (tappable → job detail)
  - Site address (tappable → maps navigation)
  - Phase label
  - Crew list (who else is on this session)
  - Session notes
  - "Complete Session" button
- **3-Day view:** Same info but for today + next 2 business days, stacked by date

**T&M Progress Snapshot (read-only, within job detail):**
- Shows per-phase: budgeted hours, actual hours, remaining hours, completion %
- Compact table or card layout
- Data source: `costingPhases` for this job — no new queries needed
- This gives Josh a quick answer when the GC asks "where are you guys at"

### 8.5 — Session Completion Flow

**Trigger:** "Complete Session" button on field view or session card.

**Flow:**
1. Tap "Complete Session"
2. Modal opens with:
   - Session summary (job, phase, dates, crew) — read-only
   - Completion note textarea with microphone button for voice input
   - Optional: logged hours field (total hours worked this session)
   - Gap tracking section:
     - "What's next?" dropdown: Ready for next session | Waiting on inspection | Waiting on materials | Waiting on other trade | Waiting on GC direction | Other
     - If "waiting": note field + earliest return date picker
3. If microphone used: capture voice-to-text, then call `/api/enhance-session-note` to clean up
4. Save: update session status to `completed`, write completionNote, completedAt, completedBy, gapInfo, loggedHours
5. Close modal

### AI Enhancement for Session Notes

Reuse the existing pattern from change order description enhancement:

```typescript
// src/app/api/enhance-session-note/route.ts
// Same pattern as /api/enhance-description/route.ts
// System prompt: "You are a construction field note editor. Clean up this
// voice-transcribed note into clear, professional language. Keep it concise.
// Preserve all technical details and trade-specific terminology.
// Do not add information that wasn't in the original."
```

---

## 9 — NOTIFICATION SYSTEM (Phase 2 — design now, build later)

Define the notification types now so the data model supports them. Actual notification delivery (push, email, Google Chat webhook) is a future build.

```typescript
interface ScheduleNotification {
  id: string;
  type: 'schedule-change' | 'daily-summary' | 'budget-warning' |
        'phase-complete' | 'stalled-job' | 'double-booking';
  recipientId: string;         // employeeId
  recipientName: string;
  jobId?: string;
  jobName?: string;
  sessionId?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
}

// Notification recipients by type:
// schedule-change:  Brittany + assigned crew on that session
// daily-summary:    All crew (evening before, time TBD)
// budget-warning:   PM + Brittany
// phase-complete:   Kristen (billing trigger) + PM
// stalled-job:      PM + Brittany (3+ weeks no sessions)
// double-booking:   PM + Brittany (at time of scheduling)
```

---

## 10 — BUILD PHASES

### Phase 1 — Core Data Model + PM Page Toggle (Build First)
**Files:** `src/types/scheduling.ts`, PM page calendar toggle, `SessionFormDrawer.tsx`
- Create `ScheduleSession` interface and all helper functions
- Create `ScheduledWork` interface (bridge — not consumed yet)
- Add dependency window fields to PM page (earliestStartDate, latestFinishDate, dependencyNote)
- Build session form drawer (create/edit/complete)
- Build PM page toggle panel showing sessions per phase
- Capacity math display (remaining hours, session capacity, status badge)
- Conflict detection with warnings
- Budget warning badges on phases
- Write `scheduleSessions` to Firestore

### Phase 2 — Calendar Page
**Files:** `src/app/calendar/page.tsx`, `MonthlyCalendar.tsx`, `SessionCard.tsx`
- Add Calendar to sidebar nav
- Monthly calendar grid with session cards
- Color-coding by job
- Filter by job, filter by crew member ("By Person")
- Today/This Week dashboard section
- Click-to-create and click-to-edit session cards
- Stalled job detection (3+ weeks)

### Phase 3 — Field Mobile View
**Files:** `FieldScheduleView.tsx`, modifications to `/jobs/[id]/page.tsx`
- Today + 3-day lookahead toggle
- Session display within job detail page
- T&M progress snapshot (read-only)
- Session completion flow with voice-to-text + AI enhancement
- Gap tracking on completion

### Phase 4 — Advanced Features (Future)
- Drag-and-drop rescheduling on calendar
- Gantt/timeline view toggle
- Gap finder view (filter: "I need X guys for Y days")
- Weekly view mode
- Notification delivery system (push, email, or Google Chat webhook)
- Automated GC weekly update email (generated from session/completion data)

---

## 11 — WHAT IS INTENTIONALLY DEFERRED

- Full time tracking module (separate build — `ScheduledWork` interface is the handshake)
- Notification delivery mechanism (data model defined, delivery TBD)
- Gantt/timeline view (Phase 4)
- Drag-and-drop rescheduling (Phase 4)
- Gap finder with capacity filtering (Phase 4)
- Automated GC weekly update email (Phase 4)
- Google Chat webhook integration for notifications
- Historical session pattern detection / AI-suggested templates
- Sub-day time precision (start time / end time within a day — not needed per requirements)
- Rate-based labor cost calculation (deferred to time tracking module)
- Calendar import from GC master schedules (Brittany said NA to this)

---

## 12 — OPEN QUESTIONS (Pending Josh's Input)

These do not block the build. They refine UX details that can be adjusted after initial implementation.

- **Q14:** When something changes on site, what info gets lost in the phone call to Brittany that a system could capture better?
- **Q15:** When deciding crew size for a session, what factors drive the decision (remaining work, physical space, how many can work at once)?
- **Q16:** What information does Josh need at a job site that he currently has to call the office to get?
- **Q17:** What's the most annoying thing about scheduling and communication from the field perspective?

---

## 13 — COMPLETION CHECKLIST

```
[ ] TYPES: src/types/scheduling.ts created with ScheduleSession, ScheduledWork interfaces
[ ] TYPES: All helper functions exported (getRemainingHours, getSessionCapacity, etc.)
[ ] TYPES: explodeSessionToScheduledWork helper function implemented
[ ] TYPES: Phase label mapping and session type labels defined
[ ] SCHEMA: scheduleSessions collection writable from app
[ ] SCHEMA: Firestore indexes created for scheduleSessions queries
[ ] SCHEMA: costingPhases documents accept new fields (earliestStartDate, etc.)
[ ] PM PAGE: Calendar toggle button in header
[ ] PM PAGE: Toggle slides phase table to compact view + reveals session panel
[ ] PM PAGE: Session panel shows sessions per phase with capacity badges
[ ] PM PAGE: Dependency window fields (earliest start, latest finish, note) editable
[ ] PM PAGE: Budget warning badges on phases (25%, 10%, 0%)
[ ] PM PAGE: "+ Add Session" opens SessionFormDrawer
[ ] DRAWER: All fields render and save correctly
[ ] DRAWER: Crew multi-select pulls from active employees
[ ] DRAWER: Prevailing wage role dropdown shown conditionally
[ ] DRAWER: Conflict detection runs on save, shows warning (does not block)
[ ] DRAWER: assignedCrewIds flat array generated on save
[ ] CALENDAR: /calendar route renders monthly calendar grid
[ ] CALENDAR: Added to AppShell sidebar navigation
[ ] CALENDAR: Session cards display in correct day cells
[ ] CALENDAR: Color-coding by job (consistent palette)
[ ] CALENDAR: Tentative sessions shown with dashed border
[ ] CALENDAR: Weekends visually muted but visible
[ ] CALENDAR: Filter by job works
[ ] CALENDAR: Filter by crew member works ("By Person" view)
[ ] CALENDAR: Today/This Week dashboard shows current sessions + warnings
[ ] CALENDAR: Click session → edit drawer. Click empty day → create drawer
[ ] FIELD: Schedule section in job detail page shows current/next session
[ ] FIELD: Today + 3-day lookahead toggle
[ ] FIELD: Tappable address opens maps navigation
[ ] FIELD: T&M progress snapshot shows phase hours breakdown
[ ] FIELD: Session completion flow with note textarea + microphone
[ ] FIELD: AI enhancement API route for session notes
[ ] FIELD: Gap tracking on completion (waitingOn, note, earliestReturn)
[ ] No TypeScript errors. No console errors. Committed after each file.
```

---

*Parker BOS — Confidential Build Document | Calendar & Scheduling Module | Generated from requirements questionnaires (Brittany, Feb 27 2026) + owner design sessions (Nate, Feb 28 2026) | scheduleSessions is a new collection — match schema exactly.*
