# Source Scheduler daily synchronization

This Worker retrieves the external schedule once daily at 10:00 UTC, caches a
45-day history and the next 400 days in Firestore, and records health in
`sourceSyncStatus/current`. Existing cached schedule documents remain available
if a later synchronization fails.

Required encrypted Worker secrets:

- `SOURCE_SCHEDULER_EMAIL`
- `SOURCE_SCHEDULER_PASSWORD`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `MANUAL_SYNC_TOKEN`

Deploy from this directory with Wrangler after adding those secrets. Never put
their values in this file, GitHub, or a `VITE_` variable.
