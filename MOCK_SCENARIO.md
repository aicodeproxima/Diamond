# Diamond — Hypothetical Church Week Mock Scenario

> **This is mock data for frontend testing and demos.** None of the people,
> contacts, bookings, or events below represent real individuals or activities.
> See "Removing or replacing the mock data" at the bottom to switch to a
> real backend.

## Overview

Diamond currently runs against a frozen, deterministic mock dataset that
simulates an **active week at a single church** with everyone booking every
activity through the app.

The scenario lives entirely in one file:
[`src/mocks/scenario-church-week.ts`](./src/mocks/scenario-church-week.ts)

The study curriculum lives in
[`src/mocks/subjects.ts`](./src/mocks/subjects.ts).

## Organization Hierarchy

| Level | Count | Notes |
|---|---|---|
| Developer (Admin) | 2 | **Michael** (no last name), **Stephen Wright** |
| Overseer | 1 | **David Park** — everything rolls up under him |
| Branch Leader | 4 | Sarah Johnson, James Wilson, Rachel Kim, Daniel Lee |
| Group Leader | 10 | All also act as **Teachers** and have study metrics |
| Team Leader | 15 | All also act as **Teachers** and have study metrics; distributed across the 10 group leaders |
| Member | 100 | All baptized, distributed evenly across the 15 teams |
| **Total users** | **132** | |

Stephen Wright sits as a second top-level admin. Everything else is under
Michael → David Park (Overseer).

## Contacts (Unbaptized)

- **50 contacts** total, all unbaptized.
- **20 are currently studying** one of the 50 Bible study subjects.
- The remaining 30 are at the "Initial Contact" pipeline stage.
- Each studying contact has:
  - `currentlyStudying: true`
  - `currentStep` (1–5)
  - `currentSubject` (one of the 50 titles)
  - Realistic session counts (2–16) and recent `lastSessionDate`

### Bible Study Curriculum — 5 steps × 10 subjects = 50

The full list is in `src/mocks/subjects.ts`. Structured as:

- **Step 1:** Forgiveness of Sins, Savior of Each Age, Jerusalem Mother,
  Sabbath, Passover, Cross-Reverence, Baptism, …
- **Step 2:** Whom the Bible Testifies About, King David, Zion, Heavenly
  Wedding Banquet, Abraham's Family, Daniel 2 & 7, Revelation 13, 17, 18, …
- **Step 3:** Trinity, Melchizedek, Mother the Source of Water of Life,
  Weeds and Wheat, The Church Bought With God's Blood, …
- **Step 4:** Church Established by the Root of David, The Last Adam,
  Biblical Sabbath, True Meaning of the Passover, …
- **Step 5:** Words of God Are Absolute, Watch Out for False Prophets,
  Second Coming, Coming on the Clouds, God's Coming From the East, …

## Rooms

Single area: **Main Church**, with 8 rooms:

| Room | Capacity | Features |
|---|---|---|
| Bible Study Room 1 | 6 | Whiteboard |
| Bible Study Room 2 | 6 | Whiteboard |
| Bible Study Room 3 | 6 | Whiteboard, Zoom Setup |
| Bible Study Room 4 | 6 | Whiteboard, Zoom Setup |
| Conference Room | 20 | Projector, Video Conf |
| Sanctuary | 300 | Stage, Sound System, Live Stream |
| Fellowship | 60 | Kitchen, Tables |
| TRE Room | 15 | Training Setup |

## Activities

Bookings can be tagged with one of 8 activity types (on top of the existing
7 "booking types"):

- Bible Study
- Group Activity
- Special Video
- Team Meeting
- Group Meeting
- Function Meeting
- Committee Meeting
- Committee Mission

Activity lives in `Booking.activity` and is defined by the `Activity` enum
in `src/lib/types/activity.ts`.

## A Week in the Life

The scenario auto-generates bookings for **the current calendar week**
(Monday through Sunday). Every render uses the same deterministic PRNG seed
so the data stays stable between refreshes.

Typical week includes:

- **~30 Bible study sessions** across the 4 study rooms (in-person and Zoom),
  one to two sessions per currently-studying contact.
- **15 team meetings** (one per team), distributed Mon–Fri in TRE Room and
  study rooms, evening slots.
- **10 group meetings** in Conference Room and Fellowship.
- **4 branch committee meetings** in Conference Room.
- **2 committee mission** sessions (outreach planning, report review).
- **2 special video** sessions in the Sanctuary.
- **1 Sabbath morning service** + fellowship meal on Saturday.
- **1 monthly function meeting** (Overseer + all leaders).
- Youth fellowship night, new teachers training, etc.

**Total: ~70–80 bookings for the week**, all visible in the Calendar page.

## New Metric: "Currently Studying"

Teachers and every level above them now track **how many of their students
(or rolled-up subtree) are currently studying a Bible subject right now**.

- `TeacherMetrics.currentlyStudying` — per-teacher count.
- `OrgNode.metrics.currentlyStudying` — rolled up for every level
  (team → group → branch → overseer).
- Displayed as a cyan graduation-cap icon in the org tree and the
  Teacher Metrics cards on the Groups page.

## Credentials

All accounts use password **`admin`**. Key usernames:

- `admin` — Michael (Dev)
- `stephen` — Stephen Wright (Dev)
- `overseer1` — David Park (Overseer)
- `branch1` … `branch4` — branch leaders
- `group1` … `group10` — group leaders (also teachers)
- `team1` … `team15` — team leaders (also teachers)
- `member1` … `member100` — members

## Removing or replacing the mock data

The entire scenario is **isolated to 2 files**:

1. `src/mocks/scenario-church-week.ts` — all generated users, rooms,
   contacts, bookings, metrics, org tree, audit log.
2. `src/mocks/subjects.ts` — the 50 Bible study subjects.

`src/mocks/data.ts` simply re-exports from `scenario-church-week.ts`, so
switching to a different scenario is a single-file edit.

### To use the real backend

1. In Vercel (or `.env.local`), set:

   ```
   NEXT_PUBLIC_MOCK_API=false
   NEXT_PUBLIC_API_URL=https://your-backend.example.com/api
   ```

2. Redeploy. MSW will stop intercepting requests — all API calls will hit
   the real Go backend. The files in `src/mocks/` are never bundled into
   the production code path when mocks are disabled (MSWProvider lazy-loads
   them only when the flag is on).

3. Optional cleanup: once the real backend is live and you no longer need
   the mocks, you can safely delete:
   - `src/mocks/scenario-church-week.ts`
   - `src/mocks/subjects.ts`
   - `src/mocks/data.ts`
   - `src/mocks/handlers.ts`
   - `src/mocks/browser.ts`
   - `public/mockServiceWorker.js`
   - `src/components/shared/MSWProvider.tsx` (and its usage in `Providers.tsx`)

No production code (pages, components, API client, stores) references
the mock files directly — they're entirely behind the MSW flag.
