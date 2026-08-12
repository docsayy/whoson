# Post-Deployment Testing Checklist

## Admin/chief/coordinator

- [ ] Open **Scheduling Integrity** and confirm dashboard cards load.
- [ ] Click a missing-call or conflict card and confirm Daily Call opens near the affected week.
- [ ] Import a small Excel file and confirm safe-new rows are preselected.
- [ ] Confirm replacement/conflict rows are not selected automatically.
- [ ] Try a wrong-PGY assignment and confirm it is blocked.
- [ ] Try holiday short duty and confirm it is allowed.
- [ ] Try short duty for a resident on another floor and confirm an override reason is required.
- [ ] Publish a call month and confirm the notification bell updates.

## Resident

- [ ] Confirm **Scheduling Integrity** is not visible.
- [ ] Open **Call Swaps** and request a swap from an assigned future call.
- [ ] Sign in as the proposed resident and accept the request.
- [ ] Confirm the administrator sees **Waiting for approval**.
- [ ] Approve it and confirm the daily-call schedule changes only in Draft.
- [ ] Publish and confirm both residents receive notifications.

## Calendar

- [ ] Create a private path on **Calendar Feed**.
- [ ] Download the `.ics` file and open it locally.
- [ ] Export a new WhosOn backup.
- [ ] Run `npm run calendars:generate -- backup.json`.
- [ ] Confirm files appear under `public/calendar/`.
- [ ] Deploy Hosting and open the private `.ics` URL.

## Existing pages

- [ ] Who's On
- [ ] Daily Call Schedule
- [ ] Block Schedule
- [ ] Attending Call Schedule
- [ ] Residents and Attendings
- [ ] Phone Directory
- [ ] Backup / Restore
- [ ] Settings
