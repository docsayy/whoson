# AGENTS.md

# WhosOn Residency Scheduling App

## Project Overview

WhosOn is a modern residency scheduling platform intended to replace AMiON for an Internal Medicine residency program.

The application manages:

- Resident scheduling
- Resident daily call scheduling
- Resident block scheduling
- Attending scheduling
- Consult scheduling
- Vacation
- Night Float
- Coverage rules
- Holiday scheduling
- Resident profiles
- Attending profiles
- Consult service profiles
- Lecture schedule (planned)
- Automatic schedule validation
- Automatic schedule generation
- Reports
- PDF / Excel export
- Backup & Restore

Primary users:

- Chief Residents
- Program Coordinators
- Administrators

Residents and attendings are primarily viewers.

---

# Technology

React

TypeScript

Material UI

Firebase Authentication

Firestore

Firebase Hosting

GitHub

Firebase Project:

whosonfhmc

Hosting:

https://whosonfhmc.web.app

---

# Coding Rules

Always:

- Run

npm run build

before finishing.

Never modify:

.env

.env.local

Never commit:

.env

Firebase secrets

Hosting cache

Never expose secrets.

Maintain TypeScript strict compatibility.

Keep components modular.

Keep Material UI styling consistent.

---

# UI Philosophy

Everything should be:

Compact

Professional

Hospital-friendly

Responsive

Desktop-first while remaining mobile friendly.

Pages should:

Fill available width

Avoid unused whitespace

Reduce excessive row height

Use compact typography

Prefer horizontal expansion instead of large vertical cards.

---

# User Roles

Administrator

Full access.

Program Coordinator

Same editing permissions as Administrator.

Chief Resident

Schedule management.

Publish schedules.

Manage residents.

Manage attendings.

Residents

View only.

Attendings

View only.

Future:

Landing page should depend on role.

Resident → Who's On

Attending → Attending Schedule

Admin → Dashboard

---

# Authentication

Current system:

Invite-code based signup.

Invite code contains:

Display name

Role

Person type

Expiration

Single-use

Signup process:

Email

Password

Invite Code

Phone Number

Confirmation screen

Creates:

Firebase Authentication account

Firestore user profile

Marks invite as used

Future improvements:

Admin invitation management

Invite history

Bulk invitations

---

# Current Main Modules

Implemented:

Who's On

Resident Management

Resident Profile

Resident Daily Call Schedule

Resident Block Schedule

Attending Management

Attending Call Schedule

Attending Profile

Consult Service Profiles

Coverage Rules

Backup & Restore

Invite Management

Settings

Future:

Lecture Schedule

Holiday Calendar

Automatic Schedule Builder

Rules Engine

Reports

Statistics

---

# Resident Profiles

Resident profile contains:

Monthly Calendar

Academic Blocks

Statistics

Print / PDF

Monthly calendar:

Previous

Next

Compact cells

Whole-year call summary

Future yearly counts:

Weekday calls

Weekend calls

Holiday calls

Short calls

Night Float

MICU

Chief call

Vacation

---

# Attending Profiles

Contains:

Monthly calendar

Assignments

Print / PDF

Compact calendar

Current coverage

Future:

Statistics

History

---

# Consult Service Profiles

Each consult service has its own page.

Examples:

GI

ID

Cardiology / CCU

MICU / Pulmonary

Neurology

Heme-Onc

Nephro / Rheum / Endo

Each profile contains:

Compact monthly calendar

Current attending

Assignment history

Print / PDF

---

# Block Structure

Academic year:

July 1 → June 30

Block 1 may be shorter.

Remaining blocks:

Thursday → Wednesday

Every block starts Thursday morning.

Night Float starts Thursday night.

Academic year configuration belongs in Settings.

---

# Required Block Rotations

Examples include:

2N

2N-CCU

Tele

MICU

Pulmonary

4 North

3 West

GI

Cardiology

Neurology

Infectious Disease

Heme-Onc

Nephro-Endo-Rheum

Admission

Jeopardy

Vacation

Elective

Ambulatory

PGY3 NF/Amb

Elective must always remain available.

---

# Night Float Rules

PGY1 NF

Works:

Thursday

Friday

Sunday

Monday

Tuesday

Wednesday

Off:

Saturday night

PGY2 NF

Works:

Thursday

Sunday

Monday

Tuesday

Wednesday

Off:

Friday

Saturday

PGY3 NF

Same schedule as PGY2.

Only 1.5 block.

Must support PGY3 NF/Amb scheduling.

Night Float assignments:

2N-CCU PGY1 NF

2N-CCU PGY2 NF

4N-3W PGY1 NF

4N-3W PGY2 NF

PGY3 NF

PGY3 NF/Amb

Never simplify these rotation names.

---

# Floor Coverage

7 AM → 4 PM

2N

1 PGY2

2 PGY1

2N-CCU

1 Senior

1 PGY1

Senior covers Medicine Consult until 4 PM.

Tele

1 PGY3 + 1 PGY1

1 PGY2 + 2 PGY1

4 North

2 Seniors

4 Interns

3 West

1 Senior

2 Interns

---

# Day Call

7 AM → 7 PM

Tele PGY1

2N-CCU PGY1

2N-CCU PGY2

4N PGY1

3W PGY1

4N-3W PGY2

Chief PGY3

Weekend additions:

Short Call Tele

Short Call 2N-CCU

Short Call 4N

Weekend PGY2 and PGY3 24-hour coverage is intentional and must NOT trigger conflict warnings.

Chief + Jeopardy is allowed.

Chief + PGY3 NF weekend overlap is allowed.

---

# MICU

4 Interns

2 MICU Seniors

2 Pulmonary Seniors

Intern:

24-hour call

Senior:

24-hour call

Intern and senior paired.

Post-call:

24 hours off.

After 4 PM:

MICU senior covers MICU consults.

Pulmonary consult ends at 4 PM.

---

# Consult Services

Senior:

GI

Cardiology / CCU

Pulmonary

MICU

Neurology

Heme-Onc

Nephrology

Endocrinology

Rheumatology

Infectious Disease

Intern:

Infectious Disease

Admission is NOT a consult service.

Admission team:

1 Senior

1 Intern

7 AM → 4 PM

First five admissions.

Then floor teams.

---

# Weekend Rules

Friday:

Regular staffing.

Senior remains overnight.

Saturday:

Weekend staffing.

Senior remains overnight.

Sunday:

Day call plus Night Float resumes Sunday night.

Weekend short calls:

Tele

2N-CCU

4 North

Holiday rules mirror weekend rules.

---

# Holiday Rules

Hospital-observed holidays only.

Consult services:

OFF

Floor seniors:

Only on-call senior required.

PGY1 on-call:

Present.

All floor interns:

Round on patients.

Finish work.

May leave after approval by on-call senior.

Treat holidays like weekends.

---

# Who's On

Public page planned.

No login required.

Everything else requires login.

Who's On modes:

Resident Calls

All Services

Admitting Attendings

Consult Services

Requirements:

Compact layout

Clickable resident names

Clickable attending names

Clickable consult services

Automatic population

Conflict warnings

Builder-only validation

Publish protection

---

# Attending Scheduling

Weekly view.

Monday → Sunday.

Compact cells.

Weekend highlighting.

Core/Admitting supports:

Date range

Attending selection

Automatic Who's On population

Consult scheduling remains date-range based.

---

# Lecture Schedule (Planned)

Dedicated page.

Stores:

Presenter

Topic

Date

Time

Location

Audience

Notifications

Future:

Upcoming lecture banner

Who's presenting today

Resident lecture history

---

# Export

Every major page should support:

Print

Save as PDF

Future:

Excel export

Pages:

Resident profile

Attending profile

Consult profile

Resident block schedule

Resident call schedule

Attending schedule

Who's On

Lecture schedule

---

# Rules Engine (Future)

Central scheduling engine.

Handles:

Block validation

Night Float

Holiday logic

Weekend logic

Conflict detection

Coverage validation

Required staffing

Rotation requirements

Automatic warnings

Fairness reports

Never block scheduling.

Warn only.

Chiefs must be able to override.

---

# Automatic Schedule Builder (Future)

Automatically generate:

Entire academic year

Blocks

Calls

Night Float

Vacation

Weekends

Holidays

Jeopardy

Consult services

Statistics

Conflict detection

Suggested fixes

---

# Development Conventions

Always prefer complete architectural solutions.

Do not remove existing features unless requested.

If interrupted by a new idea:

Keep the original task on the roadmap.

Ask whether to:

Continue current task

or

Include the new feature in the current upgrade.

Remember future roadmap items instead of letting them get lost.

When adding new pages:

Keep navigation consistent.

Use compact layouts.

Support print/PDF where appropriate.

Run build before completion.
