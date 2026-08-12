# WhosOn Upgrade Summary

## Performance and quota protection

- Persistent local cache backed by browser storage.
- Stale cached schedules can display before network completion.
- One background refresh per dataset per browser tab session.
- Seven-day cache for schedule/reference data, with manual refresh available.
- Existing no-change write suppression and batch writes retained.
- Firestore multi-tab IndexedDB persistence retained.

## Installable app

- Android and desktop install prompt.
- iOS Add to Home Screen instructions.
- Standalone display mode.
- App icons and maskable icons.
- Offline app shell.
- Runtime caching of built JavaScript, CSS, fonts, and images.
- Update-available notification.
- Shortcuts for Who's On, Daily Calls, and Lectures.

## Lectures

- Title-first mobile layout with no truncation.
- Cleaner time, presenter, and location rows.
- Business Meeting category added.
- Automatic default times by category.
- Structured location selector with custom Other option.
- Times remain editable after auto-fill.

## Scheduling policy

The upgrade does not automatically generate schedules or assign residents. All scheduling remains manually controlled.
