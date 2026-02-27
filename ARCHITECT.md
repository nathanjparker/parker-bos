# Parker BOS — Build Architect

## How to Use This File
Start every Claude Code session with: "Read ARCHITECT.md and tell me where we left off."
Update the Current Sprint section before closing Cursor each day.
Never skip the git commit at the end of a session.

---

## Current Sprint
**Module:** Estimate Module — Phase 1
**Goal:** Complete the full estimate → award → project management handoff

| Task | Status |
|---|---|
| FastPipe fixture import (paste zone, preview, confirm) | ✅ Done |
| Exclusions library settings page + seed data | ✅ Done |
| Exclusions checklist on estimate (pre-checked, saves text) | ✅ Done |
| Fix Mark Awarded — lowercase "jobs" bug | ✅ Done |
| Fix Mark Awarded — stop creating costingPhases from fixtures | ✅ Done |
| Migrate constructionFixtures → jobFixtures on award | 🔲 In Progress |
| Add bidName field to estimate form | 🔲 Not Started |
| Mark Awarded modal — Path B (link to existing job) | 🔲 Not Started |
| Budget card — group costingPhases by bidName | 🔲 Not Started |
| Estimate list — status badges per estimate | 🔲 Not Started |

**Next Action When You Return:**
Implement `bidName` field on estimate form and the two-path Mark Awarded modal.
Reference: `07_MULTI_BID_ESTIMATES.md` — the full Cursor prompt is already written there.

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
| Estimates (Basic) | Budget/T&M import works. FastPipe import now working. |
| Settings | Cost codes page. Exclusions library page (new). |

### 🔧 Partially Built
| Module | What's Missing |
|---|---|
| Estimate Module | Multi-bid (bidName), award handoff fixes, PDF generation |
| Fixture Management | jobFixtures collection exists after award. UI tab not built. |

### 🔲 Not Yet Started
| Module | Priority | Reference Doc |
|---|---|---|
| Time Tracking | High | Finance questionnaire pending |
| Purchase Orders | High | Finance questionnaire pending |
| Job Costing / Profit Analytics | High | Depends on Time Tracking + POs |
| Finance Dashboard | Medium | Depends on Job Costing |
| Mobile Field App | Medium | Depends on Time Tracking |
| Calendar | Low | Not yet designed |
| PDF Generation (Estimates + COs) | Medium | Phase 2 of Estimate Module |
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

## Estimate Module Phase 2 & 3 — Parked

**Phase 2 (PDF Generation)**
- Generate PDF proposal from estimate data
- Generate PDF from change orders
- Do not start until Phase 1 handoff is fully working and tested

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

*Last updated: February 2026*
*Primary dev environment: Cursor + Claude Code*
*Deployment: Vercel (production, live data)*
*Stack: Next.js 14, TypeScript, Firebase, Tailwind CSS*
