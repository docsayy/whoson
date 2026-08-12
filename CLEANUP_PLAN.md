# Files to remove from the existing repository

The following are confirmed or very strong legacy candidates based on the uploaded active `App.tsx` and import graph.

## Safe to delete after running the verification script

- `src/pages/Dashboard.tsx`
  - Only displays `Dashboard Works!` and is not routed.
- `src/pages/Login.tsx`
  - Replaced by `LoginPage.tsx`.
- `src/services/auth.ts`
  - Used only by the old `Login.tsx`.
- `src/types/models.ts`
  - Old parallel data model; active code uses the individual files under `src/types/`.
- `src/services/vacationService.ts`
- `src/types/vacation.ts`
  - No active Vacation page or hook uses them. Vacation is represented by the Block Schedule rotation.
- `src/utils/exportSchedule.ts`
  - No active page imports it; pages currently contain their own export helpers.
- `src/pages/ServicesPage.tsx`
  - Not routed. Do not delete `useServices.ts` or `serviceService.ts`, because Attending Call Schedule uses them.

## Remove all backup/version files accidentally stored inside `src`

Examples:

- `App(1).tsx`
- `WhosOnPage(5).tsx`
- `ResidentsPage_invite.tsx`
- `AttendingProfilePage_compact.tsx`
- `blockAssignmentService-fixed.ts`
- files ending in `_old.tsx`, `_fixed.tsx`, or `_backup.tsx`

Keep only the canonical file name in each actual source folder.

## Verify first

Run:

```bash
bash scripts/verify-unused-candidates.sh
```

It prints whether another source file still imports each candidate. Delete only those reported as `UNREFERENCED`.
