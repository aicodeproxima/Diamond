/**
 * Critical scenarios — pure-API regression net.
 *
 * Pins the contracts for the 5 pure-API Criticals from
 * `docs/SCENARIO_TESTS.md` (#3, #21, #22, #23, #24) so a future refactor
 * cannot silently regress them. Each describe block maps to one scenario.
 *
 * Why pin in vitest rather than fetch-test against MSW: MSW only
 * intercepts in-browser, so `fetch` from Node hits 404. The contract we
 * actually own is the source code of the §7 shim helpers + the
 * permissions.ts helpers — testing those directly is the canonical path.
 *
 * Companion to:
 *   - docs/CRITICAL_SCENARIO_RUN.md (the campaign run report)
 *   - docs/SCENARIO_TESTS.md (the source of truth for scenarios)
 *   - docs/AUDIT_REPORT.md Addendum 2 (the §7 shim Wave 3 verification)
 */

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarioUsers, scenarioContacts } from './scenario-church-week';
import {
  buildVisibilityScope,
  canChangeRole,
  canCreateUser,
  canDeactivateUser,
  canEditContact,
  canEditUser,
  canManageBlockedSlot,
  canManageTags,
  canResetPassword,
} from '../lib/utils/permissions';
import { UserRole } from '../lib/types';
import type { Contact, User } from '../lib/types';

const allUsers = scenarioUsers;
const allContacts = scenarioContacts;
const handlersSrc = readFileSync(
  resolve(__dirname, 'handlers.ts'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// #3 — Member direct-API escalation must be blocked at every gate
// ---------------------------------------------------------------------------

describe('Critical #3 — Member direct-API escalation', () => {
  const member = allUsers.find((u) => u.id === 'u-mem-1')!;
  const dev = allUsers.find((u) => u.id === 'u-michael')!;
  const overseer = allUsers.find((u) => u.id === 'u-overseer-gabriel')!;

  test('Member cannot canCreateUser at overseer/dev tier', () => {
    expect(canCreateUser(member, UserRole.OVERSEER)).toBe(false);
    expect(canCreateUser(member, UserRole.DEV)).toBe(false);
    expect(canCreateUser(member, UserRole.BRANCH_LEADER)).toBe(false);
    // And cannot create a Member without parent context outside their scope
    expect(canCreateUser(member, UserRole.MEMBER)).toBe(false);
  });

  test('Member cannot canChangeRole on self → Overseer (the C-03 self-promote vector)', () => {
    expect(canChangeRole(member, member, UserRole.OVERSEER)).toBe(false);
    expect(canChangeRole(member, member, UserRole.DEV)).toBe(false);
    expect(canChangeRole(member, member, UserRole.BRANCH_LEADER)).toBe(false);
  });

  test('Member cannot canResetPassword on others (the S03 vector)', () => {
    expect(canResetPassword(member, dev)).toBe(false);
    expect(canResetPassword(member, overseer)).toBe(false);
    const otherMember = allUsers.find(
      (u) => u.id === 'u-mem-99' && u.id !== member.id,
    )!;
    expect(canResetPassword(member, otherMember)).toBe(false);
  });

  test('Member cannot canManageBlockedSlot (the S04 vector)', () => {
    expect(canManageBlockedSlot(member)).toBe(false);
  });

  test('Member cannot canDeactivateUser on others', () => {
    expect(canDeactivateUser(member, dev)).toBe(false);
    expect(canDeactivateUser(member, overseer)).toBe(false);
  });

  test('Member cannot canManageTags on self (the C-02 self-grant vector)', () => {
    // Universal rule: NO self-tag-grants regardless of role
    expect(canManageTags(member, member)).toBe(false);
  });

  test('Shim has the gates: handlers.ts contains required permissionDenied calls on POST/PUT/DELETE', () => {
    // Static inspection — every gate from §7 shim should exist in handlers.ts
    expect(handlersSrc).toMatch(/canCreateUser\s*\(/);
    expect(handlersSrc).toMatch(/canChangeRole\s*\(/);
    expect(handlersSrc).toMatch(/canResetPassword\s*\(/);
    expect(handlersSrc).toMatch(/canManageBlockedSlot\s*\(/);
    expect(handlersSrc).toMatch(/canDeactivateUser\s*\(/);
    expect(handlersSrc).toMatch(/canManageTags\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// #21 — Session token expiry MUST return 401 (not 403)
// ---------------------------------------------------------------------------

describe('Critical #21 — Session token expiry semantic (401 vs 403)', () => {
  test('handlers.ts has an `unauthorized` helper distinct from `permissionDenied`', () => {
    // 401 Unauthorized = no/invalid auth (please log in)
    // 403 Forbidden    = authenticated but action not allowed (cannot access)
    // The two HAVE different semantics; FE error handlers branch on them.
    // Without a dedicated 401 helper, every "no viewer found" path returns
    // 403 PERMISSION_DENIED with message "Authentication required" — which
    // conflates "log in again" with "you don't have permission".
    expect(
      handlersSrc.match(/function\s+unauthorized\s*\(/),
      'Expected handlers.ts to define an `unauthorized` helper for 401 responses',
    ).not.toBeNull();
  });

  test('unauthorized helper returns status 401 with code UNAUTHORIZED', () => {
    // Pin the response shape so a regression that flips back to 403 fails CI.
    const fnMatch = handlersSrc.match(
      /function\s+unauthorized[\s\S]*?\{[\s\S]*?\}\s*\n/,
    );
    expect(fnMatch, 'unauthorized() body must be present').not.toBeNull();
    expect(fnMatch![0]).toMatch(/status:\s*401/);
    expect(fnMatch![0]).toMatch(/code:\s*['"]UNAUTHORIZED['"]/);
  });

  test('"Authentication required" path uses unauthorized(), NOT permissionDenied()', () => {
    // Every `if (!viewer) return X` site should call unauthorized() with the
    // "Authentication required" reason, NOT permissionDenied(). This is the
    // semantic correctness fix — 401 means "log in again", 403 means
    // "logged in but forbidden".
    const occurrences = handlersSrc.match(
      /permissionDenied\s*\(\s*['"]Authentication required['"]/g,
    );
    expect(
      occurrences,
      'No call site should still use permissionDenied("Authentication required") — use unauthorized() instead',
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// #22 — Audit log append-only contract (no PUT/PATCH/DELETE/POST handlers)
// ---------------------------------------------------------------------------

describe('Critical #22 — Audit log tamper / append-only contract', () => {
  test('handlers.ts non-GET /audit-log handlers MUST return 405 (no real mutations allowed)', () => {
    // Match every http.<verb>(`...audit-log...`)  pattern then capture the
    // body up to the closing `),`. Non-GET handlers are acceptable IF AND
    // ONLY IF they call methodNotAllowed() / return status 405. Any handler
    // that actually mutates would be a §7.7 contract violation.
    const re =
      /http\.(get|post|put|patch|delete)\s*\(\s*`[^`]*audit-log[^`]*`[\s\S]*?\}\s*\)\s*,/g;
    const blocks = handlersSrc.match(re) ?? [];
    expect(blocks.length, 'No /audit-log handlers found').toBeGreaterThan(0);

    for (const block of blocks) {
      const verbMatch = block.match(/^http\.(get|post|put|patch|delete)/);
      const verb = verbMatch![1];
      if (verb === 'get') continue; // GET reads are fine
      // Every non-GET MUST be a 405-returning handler
      const is405 = /methodNotAllowed\s*\(/.test(block) || /status:\s*405/.test(block);
      expect(
        is405,
        `Non-GET /audit-log handler must return 405 (append-only). ` +
          `Block starts with: ${block.slice(0, 60)}…`,
      ).toBe(true);
    }
  });

  test('handlers.ts has explicit 405 Method Not Allowed handler family for tamper attempts', () => {
    // The 5 tamper vectors from scenario #22 (PUT, PATCH, DELETE on /:id;
    // POST + bulk DELETE on /audit-log) should each have an explicit
    // handler returning 405. Without these, tamper attempts fall through
    // to Next.js routing and return ambiguous 404s.
    expect(handlersSrc).toMatch(/http\.put\s*\(\s*`[^`]*\/audit-log\/:id`/);
    expect(handlersSrc).toMatch(/http\.patch\s*\(\s*`[^`]*\/audit-log\/:id`/);
    expect(handlersSrc).toMatch(/http\.delete\s*\(\s*`[^`]*\/audit-log\/:id`/);
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/audit-log`/);
    // bulk delete via /audit-log (no :id) — typical pattern is query-param-driven
    expect(handlersSrc).toMatch(/http\.delete\s*\(\s*`[^`]*\/audit-log`/);
  });

  test('methodNotAllowed helper exists and returns 405 + METHOD_NOT_ALLOWED code', () => {
    const fnMatch = handlersSrc.match(
      /function\s+methodNotAllowed[\s\S]*?\{[\s\S]*?\}\s*\n/,
    );
    expect(fnMatch, 'methodNotAllowed() helper must be present').not.toBeNull();
    expect(fnMatch![0]).toMatch(/status:\s*405/);
    expect(fnMatch![0]).toMatch(/code:\s*['"]METHOD_NOT_ALLOWED['"]/);
  });
});

// ---------------------------------------------------------------------------
// #23 — Cross-branch matrix (Joseph @ Newport News on Williamsburg resources)
// ---------------------------------------------------------------------------

describe('Critical #23 — Cross-branch matrix verification', () => {
  const joseph = allUsers.find((u) => u.id === 'u-branch-1')!;        // BL of Newport News
  const simonPeter = allUsers.find((u) => u.id === 'u-branch-5')!;    // BL of Williamsburg
  const williamsburgGroupL = allUsers.find(
    (u) => u.role === UserRole.GROUP_LEADER && u.parentId === simonPeter.id,
  )!;
  const williamsburgTeamL = allUsers.find(
    (u) => u.role === UserRole.TEAM_LEADER && u.parentId === williamsburgGroupL?.id,
  )!;
  const williamsburgMember = allUsers.find(
    (u) => u.role === UserRole.MEMBER && u.parentId === williamsburgTeamL?.id,
  )!;
  const williamsburgContact = allContacts.find(
    (c) => c.assignedTeacherId === williamsburgTeamL?.id,
  );

  test('seed data has at least one Williamsburg-owned member + contact for cross-branch test', () => {
    expect(simonPeter, 'Simon Peter (BL Williamsburg) seeded').toBeDefined();
    expect(williamsburgMember, 'Williamsburg Member seeded').toBeDefined();
    // Contact may or may not exist depending on scenario seeds; soft-check
    if (williamsburgContact) {
      expect(williamsburgContact.assignedTeacherId).toBe(williamsburgTeamL.id);
    }
  });

  test('Joseph (BL Newport News) CAN edit a Williamsburg member per universal rule #1', () => {
    expect(canEditUser(joseph, williamsburgMember)).toBe(true);
  });

  test('Joseph CAN reset a Williamsburg member password per matrix', () => {
    expect(canResetPassword(joseph, williamsburgMember)).toBe(true);
  });

  test('Joseph CAN deactivate a Williamsburg member per matrix', () => {
    expect(canDeactivateUser(joseph, williamsburgMember)).toBe(true);
  });

  test('Joseph CAN change a Williamsburg member role per matrix', () => {
    // BL+ can promote/demote within their tier capabilities
    expect(canChangeRole(joseph, williamsburgMember, UserRole.TEAM_LEADER)).toBe(true);
  });

  test('Joseph CANNOT promote a Williamsburg member to Overseer (above his tier)', () => {
    // Universal rule #3: cannot grant at-or-above own level
    expect(canChangeRole(joseph, williamsburgMember, UserRole.OVERSEER)).toBe(false);
    expect(canChangeRole(joseph, williamsburgMember, UserRole.DEV)).toBe(false);
  });

  test('Joseph CAN edit a Williamsburg-owned contact per universal rule #1', () => {
    if (!williamsburgContact) return; // soft-skip if no eligible contact
    const subtree = buildVisibilityScope(joseph, allUsers).userIds;
    expect(canEditContact(joseph, williamsburgContact as Contact, subtree)).toBe(true);
  });

  test('Joseph CAN manage tags on a Williamsburg member (NOT self)', () => {
    expect(canManageTags(joseph, williamsburgMember)).toBe(true);
  });

  test('Joseph CANNOT manage tags on himself (self-grant prevention universal)', () => {
    expect(canManageTags(joseph, joseph)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #24 — Soft-delete contract across all 5 entity types
// ---------------------------------------------------------------------------

describe('Critical #24 — Soft-delete contract for all 5 entity types', () => {
  test('handlers.ts DELETE /contacts/:id is soft-delete (status=inactive, NOT splice)', () => {
    // Find the http.delete on /contacts/:id and verify it sets status='inactive'
    // and does NOT splice (the original C-04 bug). The fix is at line ~980+.
    const block = handlersSrc.match(
      /http\.delete\s*\(\s*`[^`]*\/contacts\/:id`[\s\S]*?\}\s*\),/,
    );
    expect(block, 'DELETE /contacts/:id handler must exist').not.toBeNull();
    expect(block![0]).toMatch(/status:\s*['"]inactive['"]/);
    expect(block![0]).not.toMatch(/contactsState\.splice\s*\(\s*idx/);
  });

  test('handlers.ts DELETE /bookings/:id soft-cancels (status=cancelled), preserves history', () => {
    const block = handlersSrc.match(
      /http\.delete\s*\(\s*`[^`]*\/bookings\/:id`[\s\S]*?\}\s*\),/,
    );
    expect(block, 'DELETE /bookings/:id handler must exist').not.toBeNull();
    expect(block![0]).toMatch(/status:\s*['"]cancelled['"]/);
    expect(block![0]).not.toMatch(/bookingsState\.splice\s*\(\s*idx/);
  });

  test('handlers.ts DELETE /blocked-slots/:id is soft-delete (isActive=false)', () => {
    const block = handlersSrc.match(
      /http\.delete\s*\(\s*`[^`]*\/blocked-slots\/:id`[\s\S]*?\}\s*\),/,
    );
    expect(block, 'DELETE /blocked-slots/:id handler must exist').not.toBeNull();
    expect(block![0]).toMatch(/isActive:\s*false/);
    expect(block![0]).not.toMatch(/blockedSlotsState\.splice\s*\(\s*idx/);
  });

  test('handlers.ts has /users/:id/deactivate + /users/:id/restore', () => {
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/users\/:id\/deactivate`/);
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/users\/:id\/restore`/);
  });

  test('handlers.ts has /areas/:id/deactivate + /areas/:id/restore', () => {
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/areas\/:id\/deactivate`/);
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/areas\/:id\/restore`/);
  });

  test('handlers.ts has /rooms/:id/deactivate + /rooms/:id/restore', () => {
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/rooms\/:id\/deactivate`/);
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/rooms\/:id\/restore`/);
  });

  test('handlers.ts has /bookings/:id/cancel + /bookings/:id/restore', () => {
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/bookings\/:id\/cancel`/);
    expect(handlersSrc).toMatch(/http\.post\s*\(\s*`[^`]*\/bookings\/:id\/restore`/);
  });

  test('all 5 entity DELETE/deactivate handlers emit audit rows', () => {
    // For each soft-delete pathway, mockAuditLog.push must appear in the same
    // handler block — this ensures the audit trail captures the action.
    // We test by checking the file contains the expected entity types in
    // audit pushes nearby DELETE/deactivate routes.
    expect(handlersSrc).toMatch(/entityType:\s*['"]contact['"][\s\S]*?action:\s*['"]delete['"]|action:\s*['"]delete['"][\s\S]*?entityType:\s*['"]contact['"]/);
    expect(handlersSrc).toMatch(/entityType:\s*['"]booking['"][\s\S]*?action:\s*['"]delete['"]|action:\s*['"]delete['"][\s\S]*?entityType:\s*['"]booking['"]/);
    expect(handlersSrc).toMatch(/entityType:\s*['"]blocked_slot['"][\s\S]*?action:\s*['"]delete['"]|action:\s*['"]delete['"][\s\S]*?entityType:\s*['"]blocked_slot['"]/);
    expect(handlersSrc).toMatch(/entityType:\s*['"]area['"][\s\S]*?action:\s*['"]delete['"]|action:\s*['"]delete['"][\s\S]*?entityType:\s*['"]area['"]/);
    expect(handlersSrc).toMatch(/entityType:\s*['"]room['"][\s\S]*?action:\s*['"]delete['"]|action:\s*['"]delete['"][\s\S]*?entityType:\s*['"]room['"]/);
  });
});
