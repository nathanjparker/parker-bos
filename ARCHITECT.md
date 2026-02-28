# Parker BOS — Build Architect

## How to Use This File
Start every Claude Code session with: "Read ARCHITECT.md and tell me where we left off."
Update the Current Sprint section before closing Cursor each day.
Never skip the git commit at the end of a session.

---

## Current Sprint
**Module:** Fixture Management + Estimate Module Phase 2
**Goal:** Stabilize fixture management, then move to PDF generation

| Task | Status |
|---|---|
| Fixture Management — complete and stabilize | 🔲 Not Started |
| Estimate list — status badges per estimate | ✅ Done |
| PDF generation for estimates | 🔲 Not Started |
| PDF generation for change orders | 🔲 Not Started |

**Next Action When You Return:**
Fixture Management needs serious work — start here before moving to PDF generation.

---

## Previous Sprint (Completed)
**Module:** Estimate Module — Phase 1
**Goal:** Complete the full estimate → award → project management handoff

| Task | Status |
|---|---|
| FastPipe fixture import (paste zone, preview, confirm) | ✅ Done |
| Exclusions library settings page + seed data | ✅ Done |
| Exclusions checklist on estimate (pre-checked, saves text) | ✅ Done |
| Fix Mark Awarded — lowercase "jobs" bug | ✅ Done |
| Fix Mark Awarded — stop creating costingPhases from fixtures | ✅ Done |
| Migrate constructionFixtures → jobFixtures on award | ✅ Done |
| Add bidName field to estimate form | ✅ Done |
| Mark Awarded modal — Path B (link to existing job) | ✅ Done |
| Budget card — group costingPhases by bidName | ✅ Done |
| Estimate list — status badges per estimate | ✅ Done |

---

## Modules Overview

### ✅ Built and In Production
| Module | Notes |
|---|---|
| Jobs | Core entity. Collection name is `Jobs` (capital J). |
| Change Orders | Auto-numbered CO-01, CO-02. Approval updates job currentContractValue. |
| Costing Phases | PM budget card. estHours/actualHours inline edit. |
| Companies | Phone book only. No PO history yet. |
| Contacts | Linked to companies via companyId/companyName. |
| Employees | authUid bridge added. Role/status fields exist. |
| Jurisdictions | contactIds[] array FK. Legacy contactNames string coexists. |
| Cost Codes | 12 seed codes. Managed in settings. |
| Estimates | Multi-bid (bidName), award handoff, status badges, FastPipe import. |
| Settings | Cost codes page. Exclusions library page. |

### 🔧 Partially Built
| Module | What's Missing |
|---|---|
| Estimate Module | PDF generation (Phase 2), digital acceptance (Phase 3) |
| Fixture Management | Sorting and spec library added but needs significant work before production ready |

### 🔲 Not Yet Started
| Module | Priority | Reference Doc |
|---|---|---|
| Time Tracking | High | Finance questionnaire pending |
| Purchase Orders | High | Finance questionnaire pending |
| Job Costing / Profit Analytics | High | Depends on Time Tracking + POs |
| Finance Dashboard | Medium | Depends on Job Costing |
| Mobile Field App | Medium | Depends on Time Tracking |
| Calendar | Low | Not yet designed |
| Digital Acceptance (Email + Link) | Low | Phase 3 of Estimate Module |

---

## Critical Rules — Never Break These

```
✋ Collection name is "Jobs" with capital J — not "jobs"
✋ Always denormalize: store both the ID and the name (e.g. gcId + gcName)
✋ Timestamps must be typed as Timestamp | null — never any or string
✋ costingPhases come from estimateLines only — never from constructionFixtures
✋ Show all changes before saving — always ask Cursor to do this
✋ Git commit after every working feature — never end a session without committing
```

---

## Data Relationships Quick Reference

```
Jobs
  └── costingPhases (jobId)       — budget phases, one per cost code per bid
  └── jobFixtures (jobId)         — fixtures migrated from estimate on award
  └── changeOrders (jobId)        — COs linked back to job

estimates
  └── estimateLines (estimateId)  — budget line items by cost code
  └── constructionFixtures (estimateId) — FastPipe staging, pre-award only

specSheetLibrary                  — global lookup by manufacturer + model

employees
  └── authUid field               — bridges Firebase Auth to employee record

companies
  └── contacts (companyId)        — contacts linked to company
```

---

## Naming Conventions Cursor Settled Into

- **Collections:** Capital first letter (`Jobs`, `Jobs`, `changeOrders`, `costingPhases`)
- **Document IDs:** Firestore auto-generated
- **Foreign keys:** Always store both ID and name (`gcId` + `gcName`)
- **Auto-numbers:** Formatted strings (`CO-01`, `CO-02`)
- **Timestamps:** `createdAt`, `updatedAt` on every document
- **Status fields:** Title case strings (`"Draft"`, `"Awarded"`, `"Approved"`)
- **Component files:** PascalCase (`EstimateBuilder.tsx`, `ChangeOrderForm.tsx`)
- **Route files:** lowercase with brackets (`/jobs/[id]/page.tsx`)

---

## Known Inconsistencies (Fix Opportunistically, Not Urgently)

| Issue | Location | Risk |
|---|---|---|
| jobNumber not in Job TypeScript interface | EstimateBuilder.tsx reads it | Low — works but untyped |
| createdBy stores email, CO actor fields store UID | Mixed across collections | Low — cosmetic |
| COST_CODE_LABELS incomplete | Only 6 of 12 codes defined | Low — labels show as code |
| Employee.role typed as string not EmployeeRole | employees.ts | Low |
| Jurisdiction.contactNames legacy field | jurisdictions collection | Low |
| CO number race condition | count-then-write pattern | Low — single user for now |
| Debug console.log left in | ChangeOrderForm.tsx line 191 | Cosmetic |

---

## Do Not Touch Without Reading First

| File | Why |
|---|---|
| `src/app/jobs/[id]/page.tsx` | PM is actively using this in production |
| `src/lib/employees.ts` | Auth bridge just added — authUid lookup logic is new |
| `src/components/ChangeOrderReview.tsx` | CO approval + increment logic recently fixed |
| Firestore `Jobs` collection | Live data from Airtable import. Real jobs in here. |

---

## Finance Module — Holding Pattern
The finance team (Brittany) is completing a discovery questionnaire.
Do not start building Time Tracking or Purchase Orders until answers are received.
Reference: `Parker_BOS_Finance_Questionnaire.docx`

Key decisions still needed from questionnaire:
- Who enters time: field techs self-report or foreman batch-enters?
- Time granularity: whole job or specific cost phase?
- PO approval thresholds and workflow
- QuickBooks integration scope

---

## Estimate Module Phase 2 & 3

**Phase 2 (PDF Generation)** ← Current Sprint (after Fixture Management stabilized)
- Generate PDF proposal from estimate data
- Generate PDF from change orders

**Phase 3 (Digital Acceptance)**
- Email estimate to GC with accept link
- Acceptance updates Parker BOS status automatically
- Do not start until Phase 2 PDFs are solid

---

## End of Session Checklist
Before closing Cursor:
- [ ] Update "Next Action When You Return" above
- [ ] Check off any completed tasks in Current Sprint table
- [ ] `git add . && git commit -m "feat/fix: description of what you built"`
- [ ] Note any new bugs or inconsistencies discovered in the Known Issues table

---

*Last updated: February 27, 2026*
*Primary dev environment: Cursor + Claude Code*
*Deployment: Vercel (production, live data)*
*Stack: Next.js 15, TypeScript, Firebase, Tailwind CSS*
