import { UserRole } from './types/user';

/**
 * Centralized avatar catalog.
 * Gospel Worker avatars are for Team Leader and above.
 * Default Blank Character avatars are for Members and Teachers.
 */

export interface AvatarDefinition {
  id: string;
  label: string;
  url: string;
  gender: 'male' | 'female';
  category: 'gospel-worker' | 'default';
}

export const AVATARS: AvatarDefinition[] = [
  {
    id: 'gw-caucasian-male',
    label: 'Gospel Worker — Caucasian Male',
    url: '/avatars/gw-caucasian-male.png',
    gender: 'male',
    category: 'gospel-worker',
  },
  {
    id: 'gw-caucasian-female',
    label: 'Gospel Worker — Caucasian Female',
    url: '/avatars/gw-caucasian-female.png',
    gender: 'female',
    category: 'gospel-worker',
  },
  {
    id: 'gw-african-american-male',
    label: 'Gospel Worker — African American Male',
    url: '/avatars/gw-african-american-male.png',
    gender: 'male',
    category: 'gospel-worker',
  },
  {
    id: 'gw-african-american-female',
    label: 'Gospel Worker — African American Female',
    url: '/avatars/gw-african-american-female.png',
    gender: 'female',
    category: 'gospel-worker',
  },
  {
    id: 'gw-mixed-male',
    label: 'Gospel Worker — Mixed Male',
    url: '/avatars/gw-mixed-male.png',
    gender: 'male',
    category: 'gospel-worker',
  },
  {
    id: 'gw-mixed-female',
    label: 'Gospel Worker — Mixed Female',
    url: '/avatars/gw-mixed-female.png',
    gender: 'female',
    category: 'gospel-worker',
  },
  {
    id: 'default-male',
    label: 'Default — Male',
    url: '/avatars/default-male.png',
    gender: 'male',
    category: 'default',
  },
  {
    id: 'default-female',
    label: 'Default — Female',
    url: '/avatars/default-female.png',
    gender: 'female',
    category: 'default',
  },
];

export const GOSPEL_WORKER_AVATARS = AVATARS.filter((a) => a.category === 'gospel-worker');
export const DEFAULT_AVATARS = AVATARS.filter((a) => a.category === 'default');

/** Role threshold — roles at or above Team Leader may pick a Gospel Worker avatar. */
const GOSPEL_WORKER_ROLES = new Set<UserRole>([
  UserRole.TEAM_LEADER,
  UserRole.GROUP_LEADER,
  UserRole.BRANCH_LEADER,
  UserRole.OVERSEER,
  UserRole.DEV,
]);

export function canPickGospelWorker(role: UserRole): boolean {
  return GOSPEL_WORKER_ROLES.has(role);
}

export function avatarsForRole(role: UserRole): AvatarDefinition[] {
  return canPickGospelWorker(role) ? GOSPEL_WORKER_AVATARS : DEFAULT_AVATARS;
}

export function getAvatarByUrl(url: string | undefined): AvatarDefinition | undefined {
  if (!url) return undefined;
  return AVATARS.find((a) => a.url === url);
}

/**
 * Female first names used across the mock scenario. Any first name not in
 * this set is treated as male for avatar assignment purposes.
 */
const FEMALE_FIRST_NAMES = new Set<string>([
  'Abigail', 'Amy', 'Angela', 'Anna', 'Bethany', 'Catherine', 'Chloe',
  'Claire', 'Deborah', 'Elizabeth', 'Emily', 'Emma', 'Esther', 'Eve',
  'Faith', 'Grace', 'Hannah', 'Hope', 'Ivy', 'Jade', 'Jane', 'Jasmine',
  'Jessica', 'Joanna', 'Joy', 'Julia', 'Karen', 'Katherine', 'Kim',
  'Laura', 'Lauren', 'Leah', 'Lily', 'Lydia', 'Martha', 'Mary', 'Megan',
  'Mia', 'Michelle', 'Miriam', 'Olivia', 'Phoebe', 'Rachel', 'Rebecca',
  'Rose', 'Ruth', 'Sarah', 'Sophia', 'Susan', 'Zoe',
]);

export function isFemaleFirstName(firstName: string): boolean {
  return FEMALE_FIRST_NAMES.has(firstName);
}

/** Seeded PRNG so scenario assignments are stable across reloads. */
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Pick an avatar url for a user of the given role, seeded by their id. */
export function pickAvatarForUser(
  role: UserRole,
  userId: string,
  forceFemale?: boolean,
): string {
  const pool = avatarsForRole(role);
  const filtered = forceFemale !== undefined
    ? pool.filter((a) => a.gender === (forceFemale ? 'female' : 'male'))
    : pool;
  const list = filtered.length > 0 ? filtered : pool;
  // Hash the userId into a seed
  let seed = 0;
  for (let i = 0; i < userId.length; i++) seed = (seed * 31 + userId.charCodeAt(i)) & 0xffff;
  const rand = seededRandom(seed || 1)();
  return list[Math.floor(rand * list.length)].url;
}
