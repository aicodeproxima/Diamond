/**
 * ============================================================================
 * HYPOTHETICAL CHURCH WEEK — MOCK SCENARIO
 * ============================================================================
 *
 * This file generates a complete mock dataset representing a hypothetical
 * active week at a church using Diamond for all bookings and tracking.
 *
 * It is 100% mock data used for frontend testing and demos. To replace with
 * real data when the Go backend is live:
 *
 *   1. Set NEXT_PUBLIC_MOCK_API=false in the environment.
 *   2. MSW will stop intercepting, and all API calls will hit the real backend.
 *   3. This entire file can be deleted — no production code imports from it
 *      directly. Only `src/mocks/data.ts` re-exports from here, and `data.ts`
 *      itself is only consumed by MSW handlers (src/mocks/handlers.ts) and
 *      the mock seed page (if any).
 *
 * Scenario overview:
 *   - 1 Overseer (David Park) with 2 Admins above (Michael, Stephen Wright)
 *   - 4 Branch Leaders, 10 Group Leaders (also Teachers),
 *     15 Team Leaders (also Teachers), 100 baptized Members
 *   - 50 unbaptized Contacts, 20 of whom are currently studying one of
 *     the 50 Bible study subjects (see src/mocks/subjects.ts)
 *   - 8 rooms at one Main Church area: 4 Bible Study Rooms, Conference Room,
 *     Sanctuary, Fellowship, TRE Room
 *   - A realistic week of bookings across all rooms (studies, meetings,
 *     group activities, committee meetings, special videos, etc.)
 *
 * To customize or remove this scenario, edit or replace this single file.
 * ============================================================================
 */

import {
  Activity,
  BookingStatus,
  BookingType,
  ContactStatus,
  PIPELINE_STAGE_CONFIG,
  PipelineStage,
  UserRole,
} from '@/lib/types';
import type {
  Area,
  AuditLogEntry,
  Booking,
  Contact,
  OrgNode,
  TimelineEntry,
  User,
} from '@/lib/types';
import type { TeacherMetrics } from '@/lib/types/user';
import { pickAvatarForUser, isFemaleFirstName } from '@/lib/avatars';
import { STUDY_SUBJECTS } from './subjects';

// ---------------------------------------------------------------------------
// Deterministic PRNG so mock data stays stable between renders
// ---------------------------------------------------------------------------
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seeded(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// ---------------------------------------------------------------------------
// Name pools for generating realistic-looking users
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  'Aaron', 'Abigail', 'Adam', 'Amy', 'Andrew', 'Angela', 'Anna', 'Anthony',
  'Ben', 'Bethany', 'Caleb', 'Catherine', 'Charles', 'Chloe', 'Christopher',
  'Claire', 'Daniel', 'David', 'Deborah', 'Dennis', 'Elijah', 'Elizabeth',
  'Emily', 'Emma', 'Eric', 'Esther', 'Ethan', 'Eve', 'Faith', 'Frank',
  'Gabriel', 'Grace', 'Hannah', 'Hope', 'Isaac', 'Isaiah', 'Jacob', 'Jade',
  'James', 'Jane', 'Jason', 'Jasmine', 'Jeremy', 'Jessica', 'Joanna', 'Joel',
  'John', 'Jonathan', 'Joseph', 'Joshua', 'Joy', 'Judah', 'Julia', 'Karen',
  'Katherine', 'Kevin', 'Laura', 'Lauren', 'Leah', 'Leo', 'Levi', 'Lily',
  'Luke', 'Lydia', 'Mark', 'Martha', 'Mary', 'Matthew', 'Megan', 'Micah',
  'Michelle', 'Miriam', 'Nathan', 'Nehemiah', 'Noah', 'Olivia', 'Paul',
  'Peter', 'Philip', 'Phoebe', 'Rachel', 'Rebecca', 'Reuben', 'Rose', 'Ruth',
  'Samuel', 'Sarah', 'Seth', 'Silas', 'Simon', 'Sophia', 'Stephen', 'Susan',
  'Thomas', 'Timothy', 'Titus', 'Tobias', 'Victor', 'William', 'Zachary', 'Zoe',
];
const LAST_NAMES = [
  'Adams', 'Allen', 'Anderson', 'Baker', 'Bennett', 'Brown', 'Campbell',
  'Carter', 'Chen', 'Cho', 'Clark', 'Cook', 'Cooper', 'Davis', 'Edwards',
  'Evans', 'Foster', 'Garcia', 'Gonzalez', 'Gray', 'Green', 'Hall', 'Hansen',
  'Harris', 'Hill', 'Howard', 'Hughes', 'Jackson', 'Johnson', 'Jones',
  'Kim', 'King', 'Lee', 'Lewis', 'Lopez', 'Martin', 'Martinez', 'Miller',
  'Mitchell', 'Moore', 'Morgan', 'Morris', 'Nelson', 'Nguyen', 'Park',
  'Parker', 'Patel', 'Perez', 'Peterson', 'Phillips', 'Price', 'Reed',
  'Reyes', 'Rivera', 'Roberts', 'Rogers', 'Rodriguez', 'Russell', 'Sanchez',
  'Scott', 'Smith', 'Song', 'Taylor', 'Thomas', 'Thompson', 'Torres', 'Tran',
  'Turner', 'Walker', 'Ward', 'Watson', 'White', 'Williams', 'Wilson',
  'Wright', 'Wu', 'Yang', 'Young',
];

function genName(i: number): { first: string; last: string } {
  return {
    first: FIRST_NAMES[i % FIRST_NAMES.length],
    last: LAST_NAMES[(i * 7) % LAST_NAMES.length],
  };
}

// ---------------------------------------------------------------------------
// Rooms — single Main Church area with 8 rooms
// ---------------------------------------------------------------------------
export const scenarioAreas: Area[] = [
  {
    id: 'area-main',
    name: 'Main Church',
    description: 'All church rooms and facilities',
    rooms: [
      { id: 'room-bs1', areaId: 'area-main', name: 'Bible Study Room 1', capacity: 6, features: ['Whiteboard'] },
      { id: 'room-bs2', areaId: 'area-main', name: 'Bible Study Room 2', capacity: 6, features: ['Whiteboard'] },
      { id: 'room-bs3', areaId: 'area-main', name: 'Bible Study Room 3', capacity: 6, features: ['Whiteboard', 'Zoom Setup'] },
      { id: 'room-bs4', areaId: 'area-main', name: 'Bible Study Room 4', capacity: 6, features: ['Whiteboard', 'Zoom Setup'] },
      { id: 'room-conf', areaId: 'area-main', name: 'Conference Room', capacity: 20, features: ['Projector', 'Video Conf'] },
      { id: 'room-sanct', areaId: 'area-main', name: 'Sanctuary', capacity: 300, features: ['Stage', 'Sound System', 'Live Stream'] },
      { id: 'room-fellow', areaId: 'area-main', name: 'Fellowship', capacity: 60, features: ['Kitchen', 'Tables'] },
      { id: 'room-tre', areaId: 'area-main', name: 'TRE Room', capacity: 15, features: ['Training Setup'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Users — hierarchical generation under one Overseer
// ---------------------------------------------------------------------------
// Admins (2): Michael (no last name), Stephen Wright
// Overseer (1): David Park (existing from original data)
// Branch Leaders (4), Group Leaders (10, also Teachers),
// Team Leaders (15, also Teachers), Members (100, all baptized)
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString();

function makeUser(
  id: string,
  firstName: string,
  lastName: string,
  username: string,
  role: UserRole,
  parentId?: string,
): User {
  return {
    id,
    username,
    firstName,
    lastName,
    email: `${username}@diamond.org`,
    phone: undefined,
    role,
    parentId,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: today(),
  };
}

// --- Admins (2) ---
const uMichael = makeUser('u-michael', 'Michael', '', 'admin', UserRole.DEV);
const uStephen = makeUser('u-stephen', 'Stephen', 'Wright', 'stephen', UserRole.DEV);

// --- Overseer (1) ---
const uOverseer = makeUser('u-overseer', 'David', 'Park', 'overseer1', UserRole.OVERSEER, uMichael.id);

// --- Branch Leaders (4) ---
const branchNames = [
  { first: 'Sarah', last: 'Johnson', username: 'branch1' },
  { first: 'James', last: 'Wilson', username: 'branch2' },
  { first: 'Rachel', last: 'Kim', username: 'branch3' },
  { first: 'Daniel', last: 'Lee', username: 'branch4' },
];
const branchLeaders: User[] = branchNames.map((n, i) =>
  makeUser(`u-branch-${i + 1}`, n.first, n.last, n.username, UserRole.BRANCH_LEADER, uOverseer.id),
);

// --- Group Leaders (10, also Teachers) ---
// The role is GROUP_LEADER, but they also teach (reflected via metrics + bookings).
const groupLeaderNames = [
  { first: 'Mark', last: 'Davis' },
  { first: 'Grace', last: 'Lee' },
  { first: 'Paul', last: 'Nguyen' },
  { first: 'Lydia', last: 'Chen' },
  { first: 'Peter', last: 'Kim' },
  { first: 'Hannah', last: 'Park' },
  { first: 'Luke', last: 'Wilson' },
  { first: 'Anna', last: 'Garcia' },
  { first: 'Matthew', last: 'Cho' },
  { first: 'Ruth', last: 'Tran' },
];
const groupLeaders: User[] = groupLeaderNames.map((n, i) => {
  const branchIdx = Math.floor(i / 3); // ~2-3 per branch, wraps
  const parent = branchLeaders[Math.min(branchIdx, branchLeaders.length - 1)];
  return makeUser(`u-group-${i + 1}`, n.first, n.last, `group${i + 1}`, UserRole.GROUP_LEADER, parent.id);
});

// --- Team Leaders (15, also Teachers) ---
// Distribute across the 10 group leaders: 5 groups get 2 teams, 5 get 1.
const teamLeaderNames = [
  { first: 'Tim', last: 'Baker' },
  { first: 'Eve', last: 'Carter' },
  { first: 'Noah', last: 'White' },
  { first: 'Jade', last: 'Nguyen' },
  { first: 'Sam', last: 'Foster' },
  { first: 'Mia', last: 'Lopez' },
  { first: 'Joy', last: 'Song' },
  { first: 'Ben', last: 'Hall' },
  { first: 'Zoe', last: 'Young' },
  { first: 'Max', last: 'Chen' },
  { first: 'Leo', last: 'Rivera' },
  { first: 'Ivy', last: 'Wu' },
  { first: 'Eli', last: 'Morgan' },
  { first: 'Kim', last: 'Park' },
  { first: 'Phoebe', last: 'Adams' },
];
// Distribution: group 1 gets teams 1,2 | 2 gets 3,4 | 3 gets 5,6 | 4 gets 7,8 | 5 gets 9,10 | 6-10 get 11-15
const teamToGroup: number[] = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9];
const teamLeaders: User[] = teamLeaderNames.map((n, i) =>
  makeUser(`u-team-${i + 1}`, n.first, n.last, `team${i + 1}`, UserRole.TEAM_LEADER, groupLeaders[teamToGroup[i]].id),
);

// --- Members (100, all baptized) ---
// Distribute 100 members evenly across 15 teams ≈ 6-7 per team.
const members: User[] = range(100).map((i) => {
  const n = genName(i + 3);
  const team = teamLeaders[i % teamLeaders.length];
  return makeUser(`u-mem-${i + 1}`, n.first, n.last, `member${i + 1}`, UserRole.MEMBER, team.id);
});

// Assign avatars: Gospel Worker (randomized) for Team Leader+, Default for Member/Teacher.
const _rawUsers: User[] = [
  uMichael,
  uStephen,
  uOverseer,
  ...branchLeaders,
  ...groupLeaders,
  ...teamLeaders,
  ...members,
];
for (const u of _rawUsers) {
  u.avatarUrl = pickAvatarForUser(u.role, u.id, isFemaleFirstName(u.firstName));
}
export const scenarioUsers: User[] = _rawUsers;

// ---------------------------------------------------------------------------
// Contacts — 50 unbaptized, 20 currently studying (assigned subjects)
// ---------------------------------------------------------------------------
// All 10 group leaders + 15 team leaders = 25 teacher pool for assignment.
const teacherPool = [...groupLeaders, ...teamLeaders];

/**
 * Historical session baseline by pipeline stage.
 * Represents how many lifetime study sessions a contact has accumulated
 * before this current week. The actual booking count from this week is
 * added on top by the booking generator below.
 */
function historicalBaseline(stage: PipelineStage): number {
  switch (stage) {
    case PipelineStage.FIRST_STUDY:
      return 1 + Math.floor(rand() * 3); // 1-3
    case PipelineStage.REGULAR_STUDY:
      return 5 + Math.floor(rand() * 8); // 5-12
    case PipelineStage.PROGRESSING:
      return 15 + Math.floor(rand() * 11); // 15-25
    case PipelineStage.BAPTISM_READY:
      return 25 + Math.floor(rand() * 11); // 25-35
    case PipelineStage.BAPTIZED:
      return 30 + Math.floor(rand() * 21); // 30-50
    default:
      return 0;
  }
}

/**
 * Pick a Bible study subject appropriate for a contact's current pipeline
 * stage. Progressing contacts should be on mid-level subjects, BAPTISM_READY
 * on advanced ones, etc.
 */
function subjectForStage(stage: PipelineStage, seed: number): (typeof STUDY_SUBJECTS)[number] {
  const stepForStage: Record<PipelineStage, number[]> = {
    [PipelineStage.FIRST_STUDY]: [1],
    [PipelineStage.REGULAR_STUDY]: [1, 2],
    [PipelineStage.PROGRESSING]: [2, 3],
    [PipelineStage.BAPTISM_READY]: [4, 5],
    [PipelineStage.BAPTIZED]: [5],
  };
  const validSteps = stepForStage[stage];
  const pool = STUDY_SUBJECTS.filter((s) => validSteps.includes(s.step));
  return pool[seed % pool.length];
}

/**
 * For a given pipeline stage, pick the set of subjects a contact has
 * studied so far. Roughly matches curriculum progression:
 * - FIRST_STUDY: 1-3 subjects from Step 1
 * - REGULAR_STUDY: all of Step 1 + few from Step 2
 * - PROGRESSING: all of Steps 1-2 + several from Step 3
 * - BAPTISM_READY: all of Steps 1-3 + Step 4
 * - BAPTIZED: all 50 subjects (completed the curriculum)
 */
function subjectsStudiedForStage(stage: PipelineStage, seed: number): string[] {
  const all = STUDY_SUBJECTS;
  const byStep = (step: number) => all.filter((s) => s.step === step).map((s) => s.title);

  switch (stage) {
    case PipelineStage.FIRST_STUDY: {
      // 1-3 subjects from Step 1
      const count = 1 + (seed % 3);
      return byStep(1).slice(0, count);
    }
    case PipelineStage.REGULAR_STUDY: {
      // All of Step 1 + 2-5 from Step 2
      const step2Count = 2 + (seed % 4);
      return [...byStep(1), ...byStep(2).slice(0, step2Count)];
    }
    case PipelineStage.PROGRESSING: {
      // All of Steps 1-2 + 3-7 from Step 3
      const step3Count = 3 + (seed % 5);
      return [...byStep(1), ...byStep(2), ...byStep(3).slice(0, step3Count)];
    }
    case PipelineStage.BAPTISM_READY: {
      // All of Steps 1-3 + all of Step 4 + a few from Step 5
      const step5Count = 2 + (seed % 4);
      return [...byStep(1), ...byStep(2), ...byStep(3), ...byStep(4), ...byStep(5).slice(0, step5Count)];
    }
    case PipelineStage.BAPTIZED:
      // Completed curriculum
      return all.map((s) => s.title);
    default:
      return [];
  }
}

// Helper: trace a member up to their branch leader for groupName display
function resolveBranchName(memberParentId: string | undefined): string {
  const team = teamLeaders.find((t) => t.id === memberParentId);
  if (!team) return 'Branch 1';
  const group = groupLeaders.find((g) => g.id === team.parentId);
  if (!group) return 'Branch 1';
  const branch = branchLeaders.find((b) => b.id === group.parentId);
  return branch ? `Branch ${branch.username.replace('branch', '')}` : 'Branch 1';
}

// Note: contacts are declared with mutable totalSessions; the booking generator
// below will increment it for each session it actually creates this week.
// ---------------------------------------------------------------------------
// IMPORTANT: contacts are now assigned to MEMBERS, not teachers. Each of the
// 50 contacts belongs to a specific baptized member. Metrics still roll up
// correctly because the member is in the subtree of their team → group →
// branch → overseer.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// NEW DISTRIBUTION (no more INITIAL_CONTACT — this app is for booking
// actual studies, so every contact has real engagement):
//   4  BAPTIZED       (fruit-bearing, done studying)
//   6  BAPTISM_READY  (Steps 4-5, preparing for baptism)
//  12  PROGRESSING    (Steps 2-3, moving through curriculum)
//  18  REGULAR_STUDY  (Steps 1-2, steady weekly studies)
//  10  FIRST_STUDY    (just started, on Step 1)
//  ---
//  50 total
// ---------------------------------------------------------------------------
function stageForIndex(i: number): PipelineStage {
  if (i < 4) return PipelineStage.BAPTIZED;
  if (i < 10) return PipelineStage.BAPTISM_READY;
  if (i < 22) return PipelineStage.PROGRESSING;
  if (i < 40) return PipelineStage.REGULAR_STUDY;
  return PipelineStage.FIRST_STUDY;
}

export const scenarioContacts: Contact[] = range(50).map((i) => {
  const n = genName(i + 77);
  const member = members[i];
  const stage = stageForIndex(i);
  const isBaptized = stage === PipelineStage.BAPTIZED;
  // Everyone except baptized contacts is actively studying
  const isStudying = !isBaptized;

  const subject = subjectForStage(stage, i);
  const groupName = resolveBranchName(member.parentId);

  // 3 preaching partners: the member + 2 rotating teacher-pool neighbors
  const partner1 = member.id;
  const partner2 = teacherPool[(i + 1) % teacherPool.length].id;
  const partner3 = teacherPool[(i + 2) % teacherPool.length].id;

  // Generate a realistic timeline for this contact based on their
  // pipeline stage. More advanced contacts have longer timelines.
  const timeline: TimelineEntry[] = [];
  const DAY = 86400000;
  const createdDate = new Date('2024-06-01');
  const memberName = `${member.firstName} ${member.lastName}`.trim();
  const partnerName = `${teacherPool[(i + 1) % teacherPool.length].firstName} ${teacherPool[(i + 1) % teacherPool.length].lastName}`.trim();

  // Everyone starts with a "created" event
  timeline.push({
    date: createdDate.toISOString(),
    action: 'created',
    details: `Contact created by ${memberName}`,
    userId: member.id,
    userName: memberName,
  });

  // Stage progression events (more for further stages)
  const stageOrder: PipelineStage[] = [
    PipelineStage.FIRST_STUDY,
    PipelineStage.REGULAR_STUDY,
    PipelineStage.PROGRESSING,
    PipelineStage.BAPTISM_READY,
    PipelineStage.BAPTIZED,
  ];
  const stageIdx = stageOrder.indexOf(stage);
  for (let s = 1; s <= stageIdx; s++) {
    const stageDate = new Date(createdDate.getTime() + s * 45 * DAY + Math.floor(rand() * 30 * DAY));
    const cfg = PIPELINE_STAGE_CONFIG[stageOrder[s]];
    timeline.push({
      date: stageDate.toISOString(),
      action: 'stage_change',
      details: `Pipeline stage changed to ${cfg.label}`,
      userId: member.id,
      userName: memberName,
    });
  }

  // Session events (spread over time, count based on totalSessions)
  const sessions = historicalBaseline(stage);
  const sessionSpread = Math.min(sessions, 8); // cap visible entries
  for (let s = 0; s < sessionSpread; s++) {
    const sessionDate = new Date(Date.now() - (sessionSpread - s) * 7 * DAY + Math.floor(rand() * 3 * DAY));
    timeline.push({
      date: sessionDate.toISOString(),
      action: 'session',
      details: `Bible study session conducted`,
      userId: member.id,
      userName: partnerName,
    });
  }

  // Partner assignment event
  timeline.push({
    date: new Date(createdDate.getTime() + 7 * DAY).toISOString(),
    action: 'partner_change',
    details: `Preaching partners assigned: ${memberName}, ${partnerName}`,
    userId: member.id,
    userName: memberName,
  });

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    id: `c-${i + 1}`,
    firstName: n.first,
    lastName: n.last,
    email: `${n.first.toLowerCase()}.${n.last.toLowerCase()}${i + 1}@contact.org`,
    phone: `555-${(1000 + i).toString().slice(-4)}`,
    groupName,
    type: isBaptized ? BookingType.BAPTIZED_IN_PERSON : BookingType.UNBAPTIZED_CONTACT,
    status: ContactStatus.ACTIVE,
    pipelineStage: stage,
    assignedTeacherId: member.id,
    preachingPartnerIds: [partner1, partner2, partner3],
    totalSessions: historicalBaseline(stage),
    lastSessionDate: new Date(Date.now() - Math.floor(rand() * 10) * 86400000).toISOString(),
    currentlyStudying: isStudying,
    currentStep: isStudying ? subject.step : undefined,
    currentSubject: isStudying ? subject.title : undefined,
    subjectsStudied: subjectsStudiedForStage(stage, i),
    notes: isBaptized
      ? `Baptized after completing the curriculum. Now an active member.`
      : `Currently on Step ${subject.step}, Subject ${subject.index} — ${subject.title}`,
    timeline,
    createdBy: member.id,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: today(),
  };
});

// ---------------------------------------------------------------------------
// Bookings — a realistic week of activity
// ---------------------------------------------------------------------------
// Generates bookings for Monday–Sunday of the CURRENT week.
// Covers Bible studies (in-person & Zoom), group/team/committee meetings,
// special videos, Sabbath service, fellowship meals.
// ---------------------------------------------------------------------------

function weekStart(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 Sun, 1 Mon...
  // Use THIS week's Monday so the mock bookings are always in the
  // current week and immediately visible on the calendar.
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoAt(baseDay: Date, hour: number, min = 0): string {
  const d = new Date(baseDay);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

const WEEK_START = weekStart();
const dayOf = (offset: number) => {
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() + offset);
  return d;
};

const bookings: Booking[] = [];
let bookingCounter = 0;

const BS_ROOMS = ['room-bs1', 'room-bs2', 'room-bs3', 'room-bs4'];
const CONF = 'room-conf';
const SANCT = 'room-sanct';
const FELLOW = 'room-fellow';
const TRE = 'room-tre';
const AREA = 'area-main';

/**
 * Conflict-aware slot allocator.
 * Tracks occupied 30-minute slots per (room × day × hour-minute) and refuses
 * to double-book. Use this for every addBooking call.
 */
const occupied = new Set<string>(); // key = roomId|YYYY-MM-DD|HH:MM

function slotKeys(roomId: string, start: Date, end: Date): string[] {
  const keys: string[] = [];
  const dateStr = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    keys.push(`${roomId}|${dateStr}|${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);
  }
  return keys;
}

function isFree(roomId: string, start: Date, end: Date): boolean {
  return slotKeys(roomId, start, end).every((k) => !occupied.has(k));
}

function markOccupied(roomId: string, start: Date, end: Date): void {
  slotKeys(roomId, start, end).forEach((k) => occupied.add(k));
}

interface BookingSpec {
  areaId: string;
  roomId: string;
  type: BookingType;
  activity: Activity;
  title: string;
  description?: string;
  subject?: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  teacherId?: string;
  contactId?: string;
  participants: string[];
}

/**
 * Attempt to add a booking. Returns true on success, false if the slot is
 * already occupied. Use `tryAddBooking` for any placement that might conflict.
 */
function tryAddBooking(spec: BookingSpec): boolean {
  const start = new Date(spec.startTime);
  const end = new Date(spec.endTime);
  if (!isFree(spec.roomId, start, end)) return false;
  markOccupied(spec.roomId, start, end);
  bookings.push({
    id: `b-${++bookingCounter}`,
    createdAt: today(),
    updatedAt: today(),
    ...spec,
  });
  return true;
}

/**
 * Find the first free time slot for a given room + day + duration (in 30-min steps),
 * searching hours [startHour, endHour).
 */
function findFreeTime(
  roomId: string,
  day: Date,
  durationSlots: number,
  startHour = 8,
  endHour = 22,
): { start: Date; end: Date } | null {
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      const start = new Date(day);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + durationSlots * 30 * 60000);
      if (end.getHours() >= endHour && !(end.getHours() === endHour && end.getMinutes() === 0)) continue;
      if (isFree(roomId, start, end)) return { start, end };
    }
  }
  return null;
}

// ============================================================================
// FIXED / HIGH-PRIORITY BOOKINGS FIRST (so lower-priority bookings work around them)
// ============================================================================

// --- Sabbath Service (Saturday 11am-1pm in Sanctuary) ---
tryAddBooking({
  roomId: SANCT, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.GROUP_ACTIVITY,
  title: 'Sabbath Morning Service',
  description: 'Weekly Sabbath worship',
  startTime: isoAt(dayOf(5), 11),
  endTime: isoAt(dayOf(5), 13),
  createdBy: uOverseer.id,
  participants: [],
});

// --- Sabbath Fellowship Meal (Saturday 1pm-2:30pm in Fellowship) ---
tryAddBooking({
  roomId: FELLOW, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.GROUP_ACTIVITY,
  title: 'Sabbath Fellowship Meal',
  startTime: isoAt(dayOf(5), 13),
  endTime: isoAt(dayOf(5), 14, 30),
  createdBy: groupLeaders[0].id,
  participants: [],
});

// --- Monthly Function Meeting (Monday 7pm in Conference) ---
tryAddBooking({
  roomId: CONF, areaId: AREA,
  type: BookingType.TEAM_ACTIVITIES, activity: Activity.FUNCTION_MEETING,
  title: 'Monthly Function Meeting',
  startTime: isoAt(dayOf(0), 19),
  endTime: isoAt(dayOf(0), 20, 30),
  createdBy: uOverseer.id,
  participants: [uOverseer.id, ...branchLeaders.map((b) => b.id), ...groupLeaders.map((g) => g.id)],
});

// --- Special video sessions in Sanctuary ---
tryAddBooking({
  roomId: SANCT, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.SPECIAL_VIDEO,
  title: 'Special Video: Heavenly Wedding Banquet',
  startTime: isoAt(dayOf(2), 19),
  endTime: isoAt(dayOf(2), 20, 30),
  createdBy: uOverseer.id,
  participants: [uOverseer.id],
});
tryAddBooking({
  roomId: SANCT, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.SPECIAL_VIDEO,
  title: 'Special Video: Prophecy of Daniel',
  startTime: isoAt(dayOf(3), 10),
  endTime: isoAt(dayOf(3), 11, 30),
  createdBy: branchLeaders[1].id,
  participants: [],
});

// --- Branch committee meetings (different days, Conference Room) ---
branchLeaders.forEach((leader, i) => {
  tryAddBooking({
    roomId: CONF, areaId: AREA,
    type: BookingType.TEAM_ACTIVITIES, activity: Activity.COMMITTEE_MEETING,
    title: `Branch Committee — ${leader.firstName}`,
    startTime: isoAt(dayOf(i), 10),
    endTime: isoAt(dayOf(i), 11, 30),
    createdBy: leader.id,
    participants: [leader.id, uOverseer.id],
  });
});

// --- Committee missions ---
tryAddBooking({
  roomId: FELLOW, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.COMMITTEE_MISSION,
  title: 'Community Outreach Planning',
  startTime: isoAt(dayOf(2), 14),
  endTime: isoAt(dayOf(2), 16),
  createdBy: branchLeaders[0].id,
  participants: branchLeaders.map((b) => b.id),
});
tryAddBooking({
  roomId: CONF, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.COMMITTEE_MISSION,
  title: 'Mission Report Review',
  startTime: isoAt(dayOf(4), 14),
  endTime: isoAt(dayOf(4), 15, 30),
  createdBy: uOverseer.id,
  participants: [uOverseer.id, ...branchLeaders.map((b) => b.id)],
});

// --- Youth Fellowship Night ---
tryAddBooking({
  roomId: FELLOW, areaId: AREA,
  type: BookingType.GROUP_ACTIVITIES, activity: Activity.GROUP_ACTIVITY,
  title: 'Youth Fellowship Night',
  startTime: isoAt(dayOf(4), 19),
  endTime: isoAt(dayOf(4), 21),
  createdBy: groupLeaders[3].id,
  participants: [],
});

// --- New Teachers Training ---
tryAddBooking({
  roomId: TRE, areaId: AREA,
  type: BookingType.TEAM_ACTIVITIES, activity: Activity.TEAM_MEETING,
  title: 'New Teachers Training',
  startTime: isoAt(dayOf(3), 10),
  endTime: isoAt(dayOf(3), 12),
  createdBy: branchLeaders[2].id,
  participants: [],
});

// ============================================================================
// DYNAMIC BOOKINGS (will find the next free slot)
// ============================================================================

// --- Team meetings (15 teams, ideally weeknight evenings) ---
teamLeaders.forEach((leader, i) => {
  const preferredDay = dayOf(i % 5);
  const preferredRooms = [TRE, ...BS_ROOMS];
  for (const room of preferredRooms) {
    const slot = findFreeTime(room, preferredDay, 2, 17, 22); // 5pm-10pm, 60 min
    if (slot) {
      tryAddBooking({
        roomId: room, areaId: AREA,
        type: BookingType.TEAM_ACTIVITIES, activity: Activity.TEAM_MEETING,
        title: `${leader.firstName}'s Team Meeting`,
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
        createdBy: leader.id,
        teacherId: leader.id,
        participants: [leader.id, ...members.filter((m) => m.parentId === leader.id).slice(0, 3).map((m) => m.id)],
      });
      break;
    }
  }
});

// --- Group meetings (10 groups) ---
groupLeaders.forEach((leader, i) => {
  const preferredDay = dayOf(i % 5);
  const preferredRooms = i < 5 ? [CONF, FELLOW, TRE] : [FELLOW, CONF, TRE];
  for (const room of preferredRooms) {
    const slot = findFreeTime(room, preferredDay, 3, 17, 22); // 5pm-10pm, 90 min
    if (slot) {
      tryAddBooking({
        roomId: room, areaId: AREA,
        type: BookingType.GROUP_ACTIVITIES, activity: Activity.GROUP_MEETING,
        title: `${leader.firstName}'s Group Meeting`,
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
        createdBy: leader.id,
        teacherId: leader.id,
        participants: [leader.id],
      });
      break;
    }
  }
});

// --- Bible studies for the 20 currently-studying contacts ---
// Each gets 1-2 sessions this week. Allocate to the first free BS room.
const studyingContacts = scenarioContacts.filter((c) => c.currentlyStudying);
studyingContacts.forEach((contact, i) => {
  const teacher = scenarioUsers.find((u) => u.id === contact.assignedTeacherId)!;
  const sessionsThisWeek = 1 + (i % 2);
  const isZoom = i % 4 === 0;
  for (let s = 0; s < sessionsThisWeek; s++) {
    // Try each weekday and find the first free BS room with a free hour
    for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
      const day = dayOf((i + s * 3 + dayOffset) % 6);
      const candidateRooms = isZoom ? ['room-bs3', 'room-bs4', ...BS_ROOMS] : BS_ROOMS;
      let placed = false;
      for (const room of candidateRooms) {
        const slot = findFreeTime(room, day, 2, 9, 18); // 9am-6pm, 60 min
        if (slot) {
          const added = tryAddBooking({
            roomId: room, areaId: AREA,
            type: isZoom ? BookingType.UNBAPTIZED_ZOOM : BookingType.UNBAPTIZED_CONTACT,
            activity: Activity.BIBLE_STUDY,
            subject: contact.currentSubject,
            title: `Study: ${contact.firstName} ${contact.lastName} — ${contact.currentSubject}`,
            description: `Step ${contact.currentStep}`,
            startTime: slot.start.toISOString(),
            endTime: slot.end.toISOString(),
            createdBy: teacher.id,
            teacherId: teacher.id,
            contactId: contact.id,
            participants: [teacher.id],
          });
          if (added) {
            // Increment the contact's actual session counter for this week
            contact.totalSessions += 1;
            contact.lastSessionDate = slot.start.toISOString();
          }
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }
});

// Mark a few bookings as cancelled for demo purposes
const cancelReasons = [
  'Schedule conflict with branch committee',
  'Contact rescheduled to next week',
  'Room unavailable due to maintenance',
];
for (let i = 0; i < Math.min(3, bookings.length); i++) {
  const idx = 5 + i * 8; // spread them out
  if (bookings[idx]) {
    bookings[idx] = {
      ...bookings[idx],
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(Date.now() - (3 - i) * 86400000).toISOString(),
      cancelReason: cancelReasons[i],
      cancelledBy: 'u-michael',
    } as Booking;
  }
}

export const scenarioBookings: Booking[] = bookings;

// ---------------------------------------------------------------------------
// Teacher metrics — now computed per MEMBER, since contacts are owned by
// the member who is preaching to them. Also includes teachers/team/group
// leaders with 0 counts since they don't have direct contacts anymore.
// ---------------------------------------------------------------------------
const metricUsers = [...members, ...teacherPool]; // members + leaders
export const scenarioTeacherMetrics: TeacherMetrics[] = metricUsers.map((u) => {
  const myContacts = scenarioContacts.filter((c) => c.assignedTeacherId === u.id);
  const studying = myContacts.filter((c) => c.currentlyStudying).length;
  const baptized = myContacts.filter((c) => c.pipelineStage === PipelineStage.BAPTIZED).length;
  return {
    userId: u.id,
    totalStudents: myContacts.length,
    activeStudents: myContacts.length,
    currentlyStudying: studying,
    continuedStudying: myContacts.filter((c) => c.totalSessions > 1).length,
    baptizedSinceStudying: baptized,
    totalSessionsLed: myContacts.reduce((s, c) => s + c.totalSessions, 0),
  };
});

// ---------------------------------------------------------------------------
// Org tree — nested structure with rolled-up metrics per level
// ---------------------------------------------------------------------------
function rollupMetrics(userIds: string[]) {
  const rows = scenarioTeacherMetrics.filter((m) => userIds.includes(m.userId));
  return rows.reduce(
    (acc, r) => ({
      totalStudents: acc.totalStudents + r.totalStudents,
      activeStudents: acc.activeStudents + r.activeStudents,
      currentlyStudying: acc.currentlyStudying + r.currentlyStudying,
      continuedStudying: acc.continuedStudying + r.continuedStudying,
      baptizedSinceStudying: acc.baptizedSinceStudying + r.baptizedSinceStudying,
    }),
    { totalStudents: 0, activeStudents: 0, currentlyStudying: 0, continuedStudying: 0, baptizedSinceStudying: 0 },
  );
}

function memberNode(member: User): OrgNode {
  return {
    id: member.id,
    name: `${member.firstName} ${member.lastName}`.trim(),
    role: member.role,
    avatarUrl: member.avatarUrl,
    metrics: rollupMetrics([member.id]),
    children: [],
  };
}

function teamNode(team: User): OrgNode {
  const teamMembers = members.filter((m) => m.parentId === team.id);
  const memberIds = teamMembers.map((m) => m.id);
  return {
    id: team.id,
    name: `${team.firstName} ${team.lastName}`.trim(),
    role: team.role,
    avatarUrl: team.avatarUrl,
    groupName: `Team ${team.username.replace('team', '')}`,
    metrics: rollupMetrics([team.id, ...memberIds]),
    children: teamMembers.map(memberNode),
  };
}

function groupNode(group: User): OrgNode {
  const myTeams = teamLeaders.filter((t) => t.parentId === group.id);
  const teamIds = myTeams.map((t) => t.id);
  const memberIds = members
    .filter((m) => teamIds.includes(m.parentId!))
    .map((m) => m.id);
  return {
    id: group.id,
    name: `${group.firstName} ${group.lastName}`.trim(),
    role: group.role,
    avatarUrl: group.avatarUrl,
    groupName: `Group ${group.username.replace('group', '')}`,
    metrics: rollupMetrics([group.id, ...teamIds, ...memberIds]),
    children: myTeams.map(teamNode),
  };
}

function branchNode(branch: User): OrgNode {
  const myGroups = groupLeaders.filter((g) => g.parentId === branch.id);
  const groupIds = myGroups.map((g) => g.id);
  const teamIds = teamLeaders.filter((t) => groupIds.includes(t.parentId!)).map((t) => t.id);
  const memberIds = members.filter((m) => teamIds.includes(m.parentId!)).map((m) => m.id);
  return {
    id: branch.id,
    name: `${branch.firstName} ${branch.lastName}`.trim(),
    role: branch.role,
    avatarUrl: branch.avatarUrl,
    groupName: `Branch ${branch.username.replace('branch', '')}`,
    metrics: rollupMetrics([...groupIds, ...teamIds, ...memberIds]),
    children: myGroups.map(groupNode),
  };
}

const overseerMetrics = rollupMetrics([...teacherPool.map((t) => t.id), ...members.map((m) => m.id)]);

export const scenarioOrgTree: OrgNode[] = [
  {
    id: uMichael.id,
    name: 'Michael',
    role: uMichael.role,
    avatarUrl: uMichael.avatarUrl,
    children: [
      {
        id: uOverseer.id,
        name: 'David Park',
        role: uOverseer.role,
        avatarUrl: uOverseer.avatarUrl,
        metrics: overseerMetrics,
        children: branchLeaders.map(branchNode),
      },
    ],
  },
  {
    id: uStephen.id,
    name: 'Stephen Wright',
    role: uStephen.role,
    avatarUrl: uStephen.avatarUrl,
    children: [],
  },
];

// ---------------------------------------------------------------------------
// Audit log — ~120 entries spread across the past 30 days so the Reports
// page has real data for charts, filtering, pagination, and search.
// ---------------------------------------------------------------------------
function generateAuditLog(): AuditLogEntry[] {
  const entries: AuditLogEntry[] = [];
  let id = 1;
  const now = Date.now();
  const DAY = 86400000;

  // Gather all teachers/leaders for realistic attribution
  const actors = [
    { id: uMichael.id, name: 'Michael' },
    { id: uStephen.id, name: 'Stephen Wright' },
    { id: uOverseer.id, name: 'David Park' },
    ...branchLeaders.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
    ...groupLeaders.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
    ...teamLeaders.slice(0, 6).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
  ];

  const actions: AuditLogEntry['action'][] = ['create', 'update', 'delete', 'export'];
  const entityTypes: AuditLogEntry['entityType'][] = ['booking', 'contact', 'user', 'group', 'report'];

  const detailTemplates: Record<string, string[]> = {
    'create-booking': [
      'Created Bible Study booking for Room {r}',
      'Created Fellowship event booking',
      'Created Sabbath Morning Service booking',
      'Created Team Activity booking',
      'Created Branch Committee meeting',
    ],
    'update-booking': [
      'Rescheduled booking to a later time slot',
      'Changed booking room from BS1 to BS3',
      'Updated booking participants list',
      'Extended booking duration by 30 minutes',
    ],
    'delete-booking': [
      'Cancelled booking due to schedule conflict',
      'Removed duplicate booking entry',
    ],
    'create-contact': [
      'Created new contact: {name}',
      'Added new Bible study contact',
      'Registered walk-in visitor as contact',
    ],
    'update-contact': [
      'Updated pipeline stage to Regular Study',
      'Updated pipeline stage to Progressing',
      'Updated pipeline stage to Baptism Ready',
      'Updated pipeline stage to Baptized',
      'Changed preaching partners',
      'Added study subjects',
      'Updated phone number',
      'Moved contact to a different group',
    ],
    'delete-contact': [
      'Removed inactive contact',
      'Deleted duplicate contact record',
    ],
    'create-user': [
      'Created new member account',
      'Added new team leader',
    ],
    'update-user': [
      'Promoted member to Team Leader',
      'Updated user profile information',
      'Changed user role assignment',
      'Transferred user to different branch',
    ],
    'update-group': [
      'Reorganized team assignments',
      'Updated group name',
      'Merged two teams under new leader',
    ],
    'export-report': [
      'Exported weekly activity report',
      'Exported monthly contacts summary',
      'Exported booking utilization report',
      'Exported branch performance data',
      'Exported audit log as CSV',
    ],
  };

  const contactNames = scenarioContacts.slice(0, 20).map((c) => `${c.firstName} ${c.lastName}`);

  // Generate entries spread across the past 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    // More entries for recent days (weighted: ~6/day recent, ~2/day older)
    const entriesForDay = dayOffset < 7 ? 4 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 3);
    for (let j = 0; j < entriesForDay; j++) {
      const actor = actors[Math.floor(rand() * actors.length)];
      const action = actions[Math.floor(rand() * (dayOffset < 7 ? 4 : 3))]; // exports only in recent week
      const entityType = action === 'export'
        ? 'report'
        : entityTypes[Math.floor(rand() * 4)]; // skip 'report' for non-export

      const key = `${action}-${entityType}`;
      const templates = detailTemplates[key] || [`${action} ${entityType} record`];
      let detail = templates[Math.floor(rand() * templates.length)];
      detail = detail
        .replace('{r}', `BS${1 + Math.floor(rand() * 4)}`)
        .replace('{name}', contactNames[Math.floor(rand() * contactNames.length)]);

      const hour = 8 + Math.floor(rand() * 12); // 8am-8pm
      const minute = Math.floor(rand() * 60);
      const ts = new Date(now - dayOffset * DAY);
      ts.setHours(hour, minute, 0, 0);

      entries.push({
        id: `al-${id++}`,
        action,
        entityType,
        entityId: `${entityType.charAt(0)}-${Math.floor(rand() * 100)}`,
        userId: actor.id,
        userName: actor.name,
        details: detail,
        timestamp: ts.toISOString(),
      });
    }
  }

  // Sort newest first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries;
}

export const scenarioAuditLog: AuditLogEntry[] = generateAuditLog();
