# Project Tracker — Creative Portfolio

A minimal, role-based tracker for creative projects: portfolio dashboard, timelines (Gantt), team progress, meetings and an audit trail. Built as a static, dependency-free web app (`index.html` + `styles.css` + `app.js` + `data.js`) so it runs anywhere — including GitHub Pages.

**Open it:** serve the repo (or just this folder) statically and open `tracker/index.html`, e.g.

```bash
python3 -m http.server        # then visit http://localhost:8000/tracker/
```

## What it does

The app implements the Project Tracker PRD, clubbed and simplified for a static frontend demo:

| PRD area | In the app |
|---|---|
| Roles & permissions | "Viewing as" switcher (Boss / Project Manager / HR / Team). Controls and navigation are hidden or read-only per role. |
| Lifecycle | Draft → Submitted → Approved → In progress → Completed, plus Return, Reject, On hold, Reopen, Duplicate-to-draft. |
| Timeline rules | Submission locks proposed dates; approval creates the baseline; only the PM changes committed dates, and every change requires a reason recorded in the audit history. |
| Progress & health | Progress = weighted task completion (PM override is labelled). Health (On track / At risk / Overdue / On hold) is computed and always shown with its reason. |
| Dashboard | KPI cards, health distribution, deadlines (7/30/60d), at-risk & blocked, recent activity, team workload, approvals queue. Team members get a personal "My workspace". |
| Projects | Search + filters (status, health, department, owner) remembered for the session, compact table, CSV export of the filtered set. |
| Project detail | Four tabs — Overview, Tasks, Timeline, Activity — with milestones, blockers, next actions, dependencies, comments with @mentions. |
| Gantt | Day/Week/Month zoom, baseline-vs-current bars, critical tasks and milestones highlighted, today line; editing only for the PM. |
| Calendar | Month grid with meetings (incl. weekly recurrence), milestones and deadlines; HR manages meetings, attendance, notes and follow-up actions (which become tasks only after PM approval). |
| Notifications | Unread-first feed per user with deep links (submissions, approvals, blockers, date changes, mentions, meetings, overdue work). |
| Audit | Immutable in-app log of approvals, status changes and every committed-date change (actor, timestamp, old → new, reason). |

Data is seeded with sample creative projects (avatars, wearables, animation, web) relative to today's date and persisted in `localStorage`. Use **Reset demo data** in the sidebar to restore the sample portfolio.

## Deliberately out of scope (per PRD MVP boundary, plus static-demo constraints)

- Real authentication, server-side permission enforcement, email delivery — this is a client-only demo; the PRD requires all permissions to be re-checked server-side in a real build.
- Payroll/finance/chat/document management, external calendar sync, templates, capacity planning, native mobile.
- Drag-to-reschedule on the Gantt — date changes go through an explicit dialog because a reason is mandatory anyway.
