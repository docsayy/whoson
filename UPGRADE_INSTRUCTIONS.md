# WhosOn Core Architecture Upgrade

This package is a complete `src` replacement assembled from the latest files you uploaded, plus the new architecture changes.

## Included

- URL-based routing with browser Back/Forward and shareable resident, attending, and consult-service profile URLs.
- Page-level lazy loading to reduce the initial JavaScript bundle.
- Saved Settings order drives the actual left sidebar.
- Settings available to every signed-in user:
  - My Profile
  - phone and pager
  - display name
  - first and last name for linked resident/attending profiles
  - password-reset email
- Manager-only Settings tab for theme, sidebar visibility, and page order.
- Profile updates write to the canonical user plus linked resident/attending profile.
- Current profile names, phones, and pagers are preferred over stale names stored in old schedule rows.
- Schedule edits update local state without showing a full-page loading screen, preserving vertical and horizontal scroll position.
- Mobile Who's On attending tables scroll horizontally.
- Attending name opens the attending profile.
- Consulting specialty opens the specialty profile.
- Phone number opens the dialer.
- No attending pager column.
- Active Chief appears only in Resident Calls.
- Admin-only Thursday-to-Wednesday Weekly Scheduling Assistant.
- Vacation is no longer presented as a separate request page; vacation remains an academic-year block assignment.

## Install

From the project folder:

```bash
cd ~/Desktop/residency-schedule-app

# Backup the current source
cp -R src "src-before-core-upgrade-$(date +%Y%m%d-%H%M%S)"
cp package.json "package-before-core-upgrade-$(date +%Y%m%d-%H%M%S).json"

# Unzip the downloaded package in Downloads
rm -rf ~/Downloads/whoson-v4-upgrade
unzip -o ~/Downloads/whoson-v4-upgrade.zip -d ~/Downloads

# Replace source files and update dependencies
rm -rf src
cp -R ~/Downloads/whoson-v4-upgrade/src ./src
cp ~/Downloads/whoson-v4-upgrade/package.json ./package.json

npm install
npm run build
```

Do not deploy if the build reports an error.

## Firestore rules

Profile editing may require a rules update. Do not replace your full rules file with the provided snippet. Merge the rules in:

```text
docs/FIRESTORE_RULES_PROFILE_SNIPPET.txt
```

If your existing rules already allow managers and users to update these records safely, no change may be necessary.

## Deploy

Your current `firebase.json` should remain unchanged. Since the calendar Cloud Function is not available on Spark, use your hosting-only Firebase configuration before deploying.

```bash
firebase use whosonfhmc
firebase deploy --only hosting
```

Then hard refresh the live app with `Cmd + Shift + R`.

## Test checklist

1. Reorder pages in Settings, save, and verify the left menu changes immediately.
2. Open a resident profile, refresh the browser, and confirm the same profile remains open.
3. Use browser Back to return to the previous page.
4. Edit a block assignment after scrolling down and horizontally; confirm the grid stays in the same position.
5. Edit a Daily Call assignment and Attending Call assignment; confirm no full-page spinner appears.
6. On mobile, swipe the Admitting and Consulting tables horizontally to reach the phone column.
7. Tap an attending name, specialty, and phone number.
8. Confirm Active Chief appears only in Resident Calls.
9. Open Settings as a resident and test My Profile and password reset.
10. Open Daily Call as a manager and review the Weekly Scheduling Assistant.
