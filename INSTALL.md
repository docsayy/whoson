# WhosOn Foundation + PWA Upgrade

## Included

- Persistent local schedule cache for weekly calls, monthly calls, block assignments, lectures, residents, attendings, rotations, services, and attending schedules.
- Cached data is shown immediately after browser refresh; each dataset refreshes from Firestore only once per browser tab session unless the user explicitly refreshes it.
- Firestore browser persistence remains enabled for additional offline protection.
- Installable Progressive Web App for Android and desktop Chrome/Edge.
- iPhone/iPad Add to Home Screen guidance.
- Web app manifest, app shortcuts, service worker, offline shell, icons, standalone mode, and update notification.
- Redesigned lecture cards with the lecture title as the primary content.
- Lecture category defaults:
  - Morning Report, M&M, Grand Rounds: 8:00 AM–9:00 AM
  - Noon Conference, Business Meeting: 12:00 PM–1:00 PM
- Lecture location choices: 3C, 5th Floor / Auditorium, or Other with custom text.
- Existing birthday, public access, signup, privacy, integrity, call-swap, notification, and manual scheduling features are preserved.
- No automatic schedule generation or automatic assignment.

## Install

1. Back up the current project folder and keep the existing `.env` file.
2. Extract this ZIP into the project root, replacing files when asked.
3. Run:

```bash
npm install
npm run build
```

4. Deploy:

```bash
firebase use whosonfhmc
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
```

## PWA testing

### Android / Chrome

1. Open `https://whosonfhmc.web.app/whos-on`.
2. Refresh once after deployment.
3. Use the WhosOn install prompt or Chrome menu → **Install app** / **Add to Home screen**.

### iPhone / iPad

1. Open the site in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.

### Updating an installed app

When a new service worker is detected, WhosOn displays **A new WhosOn version is available**. Tap **Update now**.

## Cache behavior

- Cached schedules render immediately when available.
- Firestore refreshes once per dataset per browser tab session.
- Returning to the same page does not repeatedly re-read the same dataset.
- Explicit page refresh/reload controls still force fresh data.
- If Firestore is unavailable or the device is offline, the last saved schedule remains available.

## Important

Do not delete the `.env` file. It is intentionally not included in this ZIP.
