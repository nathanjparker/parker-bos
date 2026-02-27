# Multi-Bid Estimates (One Job, Multiple Bids)

## Status
Discussed and fully designed. Cursor prompt written and ready to implement. Not yet built.

---

## What Was Decided

- The relationship model is: **one Job, many Estimates**
- A single job (e.g. "Skinner") can have multiple bids submitted to the same GC
- Each estimate gets an optional `bidName` field to differentiate them
- The GC can award: base bid only, one alt add, or base bid PLUS an alt add
- Contract value accumulates additively when multiple estimates are awarded
- costingPhases in the budget card are grouped by `bidName` so the office team can see what was awarded and why
- Lost estimates remain in the system but do not affect contract value or phases

---

## Schema / Data Model

### estimates — new field
```typescript
bidName?: string | null
// Examples: "Base Bid", "Alt Add 1", "Alt Add 2"
// When present: display as "JobName — BidName" everywhere
// When null: display as "JobName" (no change from current behavior)
```

### Jobs — no schema change needed
```typescript
// originalContractValue: set by FIRST awarded estimate only
// currentContractValue:  incremented by each additional awarded estimate
//   (uses Firestore increment() to avoid overwrites)
```

### costingPhases — two new fields
```typescript
estimateId: string    // Which estimate created this phase
bidName: string       // estimate.bidName OR "Base Bid" if null
```

---

## File Paths

```
src/components/EstimateBuilder.tsx               — bidName field + Mark Awarded modal changes
src/app/estimates/page.tsx                       — Estimate list (add status badges)
src/components/JobBudgetCard.tsx                 — Budget card grouping by bidName
  (or wherever the CONTRACTED WORK section renders)
```

---

## Business Logic

### bidName Display Rule
```
bidName present  → show as "Skinner — Alt Add 2" everywhere in app
bidName null     → show as "Skinner" (no change)
```

### Mark Awarded Modal — Two Paths
When user clicks Mark Awarded:

**Path A — Create New Job** (first estimate for this job)
- Pre-fill job name field from estimate's jobName
- Create new Job document
- Set `originalContractValue` and `currentContractValue` = estimate's totalContractValue
- Create costingPhases tagged with this estimate's bidName

**Path B — Link to Existing Job** (subsequent estimates for same job)
- Show searchable dropdown of existing Jobs
- Do NOT overwrite `originalContractValue`
- Use `increment(estimate.totalContractValue)` on `currentContractValue`
- Create additional costingPhases tagged with this estimate's bidName
- Both the job and the existing awarded estimate remain unchanged

### Budget Card Grouping
```
If all costingPhases share the same bidName (or all are null):
  → Display as "CONTRACTED WORK" with no subheader (existing behavior)

If costingPhases have different bidNames:
  → Display grouped with subheaders:

  CONTRACTED WORK — Base Bid
    Groundwork        $35,988
    Rough In          $61,595
    Trim              $40,616

  CONTRACTED WORK — Alt Add 2
    Rough In          $12,400
    Trim               $8,200
```

### Contract Value Integrity
- `originalContractValue` = contract value at time of initial award, never changes
- `currentContractValue` = originalContractValue + all subsequent awarded estimates + approved change orders
- Each award only touches `currentContractValue` via increment (except the first which sets both)

### Estimate List — Status Badges
Each estimate in the list shows a status badge: Draft | Opportunity | Awarded | Lost

---

## Real-World Example That Drove This Design

**Job: Skinner** (restaurant remodel)
- Existing bathrooms with wall-mount toilets
- GC requested three options:

| Bid | Description | Outcome |
|---|---|---|
| Base Bid | Like-for-like replacement, new wall-mount porcelain | Awarded |
| Alt Add 1 | Replace with floor-mount toilets (significant extra plumbing) | Not awarded |
| Alt Add 2 | TBD | Could be awarded in addition to Base Bid |

This is a standard construction industry pattern. Parker Services encounters it regularly.

---

## What Is Intentionally Deferred

- Side-by-side estimate comparison view (Base Bid vs Alt Add 2 on one screen)
- Printing or exporting multiple bids together in one proposal document
- Automatic detection of overlapping scope between bids
- Bid leveling tools

---

## Open Questions

- When you submit multiple bids to a GC, do you present them in one document or separate documents?
- Is there a case where you'd award only the alt add and NOT the base bid? (Seems unlikely but worth confirming)
- Should the estimate list page filter by job so you can see all bids for Skinner together?
- Do you need a "pending" status between submitted and awarded/lost?

---

## Key Context

- This design came directly from the real Skinner job scenario Nate described
- Alt adds are standard in commercial construction — the GC gets competitive options
- The additive contract value model mirrors how real construction contracts work (base contract + accepted alternates = total contract value)
- Brittany needs to see clearly in project management which phases belong to which bid, especially when multiple bids are awarded
