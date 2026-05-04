import { http, HttpResponse } from 'msw';
import {
  mockUsers,
  mockAreas,
  mockBookings,
  mockBlockedSlots,
  mockContacts,
  mockOrgTree,
  mockTeacherMetrics,
  mockAuditLog,
} from './data';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

/**
 * Mutable in-memory copies so PUT/DELETE/POST actually mutate and subsequent
 * GETs reflect the change. This keeps everything client-side and ephemeral —
 * a refresh resets everything back to the scenario.
 *
 * Call `resetMockState()` from auth-store.logout() so a second demo-user
 * session starts with a clean slate instead of carrying over the previous
 * user's mutations (audit L-6).
 *
 * NOTE: `resetMockState` truncates the audit log on logout. This is a
 * MOCK-ONLY behavior — the real backend's audit log is append-only per
 * docs/PERMISSIONS.md and must NEVER expose anything analogous. Do not
 * generalize this pattern. (AUDIT-6.)
 */
const contactsState = [...mockContacts];
const bookingsState = [...mockBookings];
const usersState = [...mockUsers];
const blockedSlotsState = [...mockBlockedSlots];
// Areas state — deep-cloned so room mutations don't leak into mockAreas.
const areasState = mockAreas.map((a) => ({ ...a, rooms: a.rooms.map((r) => ({ ...r })) }));
const initialAuditLogLength = mockAuditLog.length;

export function resetMockState() {
  contactsState.splice(0, contactsState.length, ...mockContacts);
  bookingsState.splice(0, bookingsState.length, ...mockBookings);
  usersState.splice(0, usersState.length, ...mockUsers);
  blockedSlotsState.splice(0, blockedSlotsState.length, ...mockBlockedSlots);
  areasState.splice(
    0,
    areasState.length,
    ...mockAreas.map((a) => ({ ...a, rooms: a.rooms.map((r) => ({ ...r })) })),
  );
  // Trim any audit log entries that accumulated during this session.
  if (mockAuditLog.length > initialAuditLogLength) {
    mockAuditLog.splice(initialAuditLogLength);
  }
}

/**
 * Resolve an actor user record from an `actorId` body field. The mock
 * frontend passes the current user's id with every mutation so the audit
 * log can attribute the action; real backend will read this from the JWT.
 */
function resolveActor(actorId: string | undefined): { id: string; name: string } {
  const id = actorId ?? 'unknown';
  const u = usersState.find((x) => x.id === id);
  const name = u
    ? `${u.firstName} ${u.lastName}`.trim() || u.username
    : id;
  return { id, name };
}

/**
 * BLOCK-2 helper: returns the active blocked-slot record that the booking's
 * (areaId, startTime, endTime) tuple would overlap, or undefined.
 * Mirrors the logic in `src/lib/utils/availability.ts:findOverlappingBlockedSlot`
 * but reads from the live `blockedSlotsState` so admin-created blocks take
 * effect immediately.
 */
function findBookingBlockedConflict(body: Record<string, unknown>):
  | { id: string; reason: string; scope: string }
  | undefined {
  const start = typeof body.startTime === 'string' ? new Date(body.startTime) : null;
  const end = typeof body.endTime === 'string' ? new Date(body.endTime) : null;
  const areaId = typeof body.areaId === 'string' ? body.areaId : undefined;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;

  for (const slot of blockedSlotsState) {
    if (slot.isActive === false) continue;
    if (slot.scope === 'area' && slot.areaId !== areaId) continue;

    if (slot.recurrence === 'weekly') {
      if (slot.dayOfWeek !== start.getDay()) continue;
      if (!slot.startTime || !slot.endTime) continue;
      const [bsh, bsm] = slot.startTime.split(':').map(Number);
      const [beh, bem] = slot.endTime.split(':').map(Number);
      const bsMin = bsh * 60 + bsm;
      const beMin = beh * 60 + bem;
      const ssMin = start.getHours() * 60 + start.getMinutes();
      const seMin = end.getHours() * 60 + end.getMinutes();
      if (bsMin < seMin && beMin > ssMin) {
        return { id: slot.id, reason: slot.reason, scope: slot.scope };
      }
    } else if (slot.recurrence === 'one-off') {
      if (!slot.startDateTime || !slot.endDateTime) continue;
      const bs = new Date(slot.startDateTime).getTime();
      const be = new Date(slot.endDateTime).getTime();
      if (bs < end.getTime() && be > start.getTime()) {
        return { id: slot.id, reason: slot.reason, scope: slot.scope };
      }
    }
  }
  return undefined;
}

export const handlers = [
  // Auth
  http.post(`${API}/login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    const username = String(body.username || '');
    const user = usersState.find((u) => u.username === username);
    const now = new Date().toISOString();

    const fail = (reason: string) => {
      // AUDIT-2: emit a login_failed entry with the attempted username so
      // brute-force / probing patterns can be reconstructed. entityId is
      // the attempted username (no user id available).
      mockAuditLog.push({
        id: 'al-' + Date.now() + '-lf',
        action: 'login_failed',
        entityType: 'login_failed',
        entityId: username || 'unknown',
        userId: 'anonymous',
        userName: username || 'unknown',
        details: `Failed login: ${reason}`,
        timestamp: now,
      });
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    };

    if (!user) return fail('unknown user');
    // Seeded users use 'admin'; users created via the registry wizard
    // accept any non-empty password (prototype — Mike's backend will own
    // real password storage).
    const isSeeded = mockUsers.some((u) => u.id === user.id);
    if (isSeeded && body.password !== 'admin') return fail('bad password');
    if (!isSeeded && !body.password) return fail('empty password');

    // AUDIT-2: emit login_success
    mockAuditLog.push({
      id: 'al-' + Date.now() + '-ls',
      action: 'login',
      entityType: 'login_success',
      entityId: user.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`.trim() || user.username,
      details: `Login success: @${user.username}`,
      timestamp: now,
    });

    return HttpResponse.json({ token: 'mock-jwt-token-' + user.id, user });
  }),

  http.get(`${API}/me`, () => {
    return HttpResponse.json(mockUsers[0]);
  }),

  // Areas & Rooms
  // GET /areas — by default returns ACTIVE areas with their ACTIVE rooms.
  // Pass ?includeInactive=1 to see soft-deleted records (used by the admin
  // RoomsTab to show restorable items).
  http.get(`${API}/areas`, ({ request }) => {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === '1';
    if (includeInactive) {
      return HttpResponse.json(areasState);
    }
    return HttpResponse.json(
      areasState
        .filter((a) => a.isActive !== false)
        .map((a) => ({ ...a, rooms: a.rooms.filter((r) => r.isActive !== false) })),
    );
  }),

  http.post(`${API}/areas`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || '').trim();
    if (!name) return HttpResponse.json({ message: 'Name required' }, { status: 400 });
    const newArea = {
      id: 'area-' + Date.now(),
      name,
      description: typeof body.description === 'string' ? body.description : '',
      rooms: [],
      isActive: true,
    } as typeof areasState[number];
    areasState.push(newArea);
    return HttpResponse.json(newArea, { status: 201 });
  }),

  http.put(`${API}/areas/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = areasState.findIndex((a) => a.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.rooms;
    areasState[idx] = { ...areasState[idx], ...sanitized } as typeof areasState[number];
    return HttpResponse.json(areasState[idx]);
  }),

  http.post(`${API}/areas/:id/deactivate`, ({ params }) => {
    const idx = areasState.findIndex((a) => a.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    areasState[idx] = { ...areasState[idx], isActive: false };
    return HttpResponse.json(areasState[idx]);
  }),

  http.post(`${API}/areas/:id/restore`, ({ params }) => {
    const idx = areasState.findIndex((a) => a.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    areasState[idx] = { ...areasState[idx], isActive: true };
    return HttpResponse.json(areasState[idx]);
  }),

  // POST /areas/:areaId/rooms — add a room to a specific area.
  http.post(`${API}/areas/:areaId/rooms`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const areaId = String(params.areaId);
    const idx = areasState.findIndex((a) => a.id === areaId);
    if (idx === -1) return HttpResponse.json({ message: 'Area not found' }, { status: 404 });
    const name = String(body.name || '').trim();
    if (!name) return HttpResponse.json({ message: 'Name required' }, { status: 400 });
    if (areasState[idx].rooms.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.isActive !== false)) {
      return HttpResponse.json({ message: 'A room with that name already exists in this area' }, { status: 409 });
    }
    const newRoom = {
      id: 'room-' + Date.now(),
      areaId,
      name,
      capacity: typeof body.capacity === 'number' ? body.capacity : 6,
      features: Array.isArray(body.features) ? (body.features as string[]) : [],
      isActive: true,
    } as typeof areasState[number]['rooms'][number];
    areasState[idx].rooms.push(newRoom);
    return HttpResponse.json(newRoom, { status: 201 });
  }),

  // PUT /rooms/:id — update room fields. Looks up by room id across all areas.
  http.put(`${API}/rooms/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    for (const area of areasState) {
      const ridx = area.rooms.findIndex((r) => r.id === params.id);
      if (ridx === -1) continue;
      const sanitized = { ...body };
      delete sanitized.id;
      delete sanitized.areaId;
      area.rooms[ridx] = { ...area.rooms[ridx], ...sanitized } as typeof area.rooms[number];
      return HttpResponse.json(area.rooms[ridx]);
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  http.post(`${API}/rooms/:id/deactivate`, ({ params }) => {
    for (const area of areasState) {
      const ridx = area.rooms.findIndex((r) => r.id === params.id);
      if (ridx === -1) continue;
      area.rooms[ridx] = { ...area.rooms[ridx], isActive: false };
      return HttpResponse.json(area.rooms[ridx]);
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  http.post(`${API}/rooms/:id/restore`, ({ params }) => {
    for (const area of areasState) {
      const ridx = area.rooms.findIndex((r) => r.id === params.id);
      if (ridx === -1) continue;
      area.rooms[ridx] = { ...area.rooms[ridx], isActive: true };
      return HttpResponse.json(area.rooms[ridx]);
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // Blocked time slots — service times and admin-defined blackout windows.
  // GET supports an optional ?areaId filter; when set, returns global blocks
  // plus that area's blocks. Without filter, returns everything.
  http.get(`${API}/blocked-slots`, ({ request }) => {
    const url = new URL(request.url);
    const areaId = url.searchParams.get('areaId');
    const active = blockedSlotsState.filter((s) => s.isActive !== false);
    if (!areaId) return HttpResponse.json(active);
    return HttpResponse.json(
      active.filter((s) => s.scope === 'global' || s.areaId === areaId),
    );
  }),

  http.post(`${API}/blocked-slots`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    // BLOCK-4: validate required fields explicitly; do not spread unsanitized.
    const scope = body.scope === 'global' || body.scope === 'area' ? body.scope : 'global';
    const recurrence = body.recurrence === 'weekly' || body.recurrence === 'one-off'
      ? body.recurrence
      : 'weekly';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return HttpResponse.json({ message: 'Reason required' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const newSlot = {
      id: 'bs-' + Date.now(),
      isActive: true,
      createdAt: now,
      scope,
      recurrence,
      reason,
      areaId: typeof body.areaId === 'string' ? body.areaId : undefined,
      dayOfWeek: typeof body.dayOfWeek === 'number' ? body.dayOfWeek : undefined,
      startTime: typeof body.startTime === 'string' ? body.startTime : undefined,
      endTime: typeof body.endTime === 'string' ? body.endTime : undefined,
      date: typeof body.date === 'string' ? body.date : undefined,
      createdBy: typeof body.actorId === 'string' ? body.actorId : undefined,
    } as typeof blockedSlotsState[number];
    blockedSlotsState.push(newSlot);
    // AUDIT-3: emit blocked_slot create entry.
    const actor = resolveActor(typeof body.actorId === 'string' ? body.actorId : undefined);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'create',
      entityType: 'blocked_slot',
      entityId: newSlot.id,
      userId: actor.id,
      userName: actor.name,
      details: `Created blocked slot: ${reason}`,
      after: newSlot,
      timestamp: now,
    });
    return HttpResponse.json(newSlot, { status: 201 });
  }),

  http.put(`${API}/blocked-slots/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = blockedSlotsState.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const before = blockedSlotsState[idx];
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.createdAt;
    delete sanitized.actorId;
    const updated = { ...before, ...sanitized };
    blockedSlotsState[idx] = updated as typeof blockedSlotsState[number];
    // AUDIT-3: emit blocked_slot update entry.
    const actor = resolveActor(typeof body.actorId === 'string' ? body.actorId : undefined);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'blocked_slot',
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      details: `Updated blocked slot: ${updated.reason ?? ''}`,
      before,
      after: updated,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(updated);
  }),

  http.delete(`${API}/blocked-slots/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = blockedSlotsState.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const before = blockedSlotsState[idx];
    // Soft-delete via isActive=false (consistent with PERMISSIONS.md rule).
    blockedSlotsState[idx] = { ...before, isActive: false };
    // AUDIT-3: emit blocked_slot delete entry.
    const actor = resolveActor(body.actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'delete',
      entityType: 'blocked_slot',
      entityId: before.id,
      userId: actor.id,
      userName: actor.name,
      details: `Removed blocked slot: ${before.reason ?? ''}`,
      before,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true });
  }),

  // Bookings
  http.get(`${API}/bookings`, ({ request }) => {
    const url = new URL(request.url);
    const areaId = url.searchParams.get('areaId');
    let filtered = bookingsState;
    if (areaId) filtered = filtered.filter((b) => b.areaId === areaId);
    return HttpResponse.json(filtered);
  }),

  http.get(`${API}/bookings/:id`, ({ params }) => {
    const booking = bookingsState.find((b) => b.id === params.id);
    if (!booking) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(booking);
  }),

  http.post(`${API}/bookings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    // BLOCK-2/BE-2: reject overlap with blocked slots with 409. The matrix's
    // "no one overrides a blocked slot" rule must hold even at the mock-API
    // layer because that is the demo's effective backend.
    const conflict = findBookingBlockedConflict(body);
    if (conflict) {
      return HttpResponse.json(
        {
          message: `Overlaps blocked window: ${conflict.reason}`,
          code: 'BLOCKED_SLOT_CONFLICT',
          details: { type: 'blocked_slot', slot: conflict },
        },
        { status: 409 },
      );
    }
    const newBooking = {
      id: 'b' + Date.now(),
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as typeof bookingsState[number];
    bookingsState.push(newBooking);
    return HttpResponse.json(newBooking, { status: 201 });
  }),

  http.put(`${API}/bookings/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = bookingsState.findIndex((b) => b.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    // BLOCK-2/BE-2: reject 409 on edit-into-blocked-slot.
    const conflict = findBookingBlockedConflict({ ...bookingsState[idx], ...body });
    if (conflict) {
      return HttpResponse.json(
        {
          message: `Overlaps blocked window: ${conflict.reason}`,
          code: 'BLOCKED_SLOT_CONFLICT',
          details: { type: 'blocked_slot', slot: conflict },
        },
        { status: 409 },
      );
    }
    const updated = { ...bookingsState[idx], ...body, updatedAt: new Date().toISOString() };
    bookingsState[idx] = updated as typeof bookingsState[number];
    // M-6 follow-up: when the BookingWizard supplies an editReason,
    // persist an audit log entry so the Reports page reflects it.
    const reason =
      typeof body.editReason === 'string' ? body.editReason.trim() : '';
    if (reason) {
      mockAuditLog.push({
        id: 'al-' + Date.now(),
        action: 'update',
        entityType: 'booking',
        entityId: updated.id,
        userId: 'u-michael',
        userName: 'Michael',
        details: `Edited booking: ${reason}`,
        timestamp: new Date().toISOString(),
      });
    }
    return HttpResponse.json(updated);
  }),

  // CAL-5: convert hard-delete to soft-cancel so booking history is
  // preserved and the audit trail captures the deletion. Universal rule
  // #7 in PERMISSIONS.md ("Soft delete only") applies.
  http.delete(`${API}/bookings/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = bookingsState.findIndex((b) => b.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const before = bookingsState[idx];
    const updated = {
      ...before,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason: 'Booking deleted',
      cancelledBy: typeof body.actorId === 'string' ? body.actorId : 'unknown',
      updatedAt: new Date().toISOString(),
    };
    bookingsState[idx] = updated as typeof bookingsState[number];
    const actor = resolveActor(body.actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'delete',
      entityType: 'booking',
      entityId: before.id,
      userId: actor.id,
      userName: actor.name,
      details: `Deleted booking "${before.title}" (soft-cancelled, history preserved)`,
      before,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true });
  }),

  // Cancel a booking (soft-delete with reason tracking + audit log)
  http.post(`${API}/bookings/:id/cancel`, async ({ request, params }) => {
    const body = (await request.json()) as { reason?: string };
    const idx = bookingsState.findIndex((b) => b.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const booking = bookingsState[idx];
    const updated = {
      ...booking,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason: (body.reason || '').trim(),
      cancelledBy: 'u-michael',
      updatedAt: new Date().toISOString(),
    };
    bookingsState[idx] = updated as typeof bookingsState[number];
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'cancel',
      entityType: 'booking',
      entityId: updated.id,
      userId: 'u-michael',
      userName: 'Michael',
      details: `Cancelled booking "${booking.title}": ${body.reason || 'No reason'}`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(updated);
  }),

  // Restore a cancelled booking
  http.post(`${API}/bookings/:id/restore`, ({ params }) => {
    const idx = bookingsState.findIndex((b) => b.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const booking = bookingsState[idx];
    const updated = {
      ...booking,
      status: 'active',
      cancelledAt: undefined,
      cancelReason: undefined,
      cancelledBy: undefined,
      updatedAt: new Date().toISOString(),
    };
    bookingsState[idx] = updated as typeof bookingsState[number];
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'booking',
      entityId: updated.id,
      userId: 'u-michael',
      userName: 'Michael',
      details: `Restored cancelled booking "${booking.title}"`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(updated);
  }),

  // Contacts — supports search, type, stage, sort
  http.get(`${API}/contacts`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const type = url.searchParams.get('type');
    const stage = url.searchParams.get('stage');
    const sort = url.searchParams.get('sort') || 'name';
    const sortDir = url.searchParams.get('sortDir') || 'asc';

    let filtered = [...contactsState];
    if (search) filtered = filtered.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.email || ''} ${c.phone || ''} ${c.groupName || ''}`.toLowerCase().includes(search),
    );
    if (type && type !== 'all') filtered = filtered.filter((c) => c.type === type);
    if (stage && stage !== 'all') filtered = filtered.filter((c) => c.pipelineStage === stage);

    // Sort
    const dir = sortDir === 'desc' ? -1 : 1;
    const stageOrder: Record<string, number> = {
      first_study: 0, regular_study: 1, progressing: 2, baptism_ready: 3, baptized: 4,
    };
    filtered.sort((a, b) => {
      switch (sort) {
        case 'sessions': return (a.totalSessions - b.totalSessions) * dir;
        case 'stage': return ((stageOrder[a.pipelineStage] || 0) - (stageOrder[b.pipelineStage] || 0)) * dir;
        case 'updated': return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
        default: return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) * dir;
      }
    });

    return HttpResponse.json(filtered);
  }),

  http.post(`${API}/contacts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newContact = {
      id: 'c' + Date.now(),
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as typeof contactsState[number];
    contactsState.push(newContact);
    return HttpResponse.json(newContact, { status: 201 });
  }),

  http.put(`${API}/contacts/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = contactsState.findIndex((c) => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const updated = { ...contactsState[idx], ...body, updatedAt: new Date().toISOString() };
    contactsState[idx] = updated as typeof contactsState[number];
    return HttpResponse.json(updated);
  }),

  http.delete(`${API}/contacts/:id`, ({ params }) => {
    const idx = contactsState.findIndex((c) => c.id === params.id);
    if (idx !== -1) contactsState.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // Groups / Org
  http.get(`${API}/groups/tree`, () => {
    return HttpResponse.json(mockOrgTree);
  }),

  http.get(`${API}/metrics/teachers`, () => {
    return HttpResponse.json(mockTeacherMetrics);
  }),

  // Audit — supports filtering, search, and pagination
  http.get(`${API}/audit-log`, ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const entityType = url.searchParams.get('entityType');
    const userId = url.searchParams.get('userId');
    const search = url.searchParams.get('search')?.toLowerCase();
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '25', 10);

    let filtered = [...mockAuditLog];
    if (action) filtered = filtered.filter((e) => e.action === action);
    if (entityType) filtered = filtered.filter((e) => e.entityType === entityType);
    if (userId) filtered = filtered.filter((e) => e.userId === userId);
    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.details.toLowerCase().includes(search) ||
          e.userName.toLowerCase().includes(search) ||
          e.action.includes(search) ||
          e.entityType.includes(search) ||
          e.entityId.toLowerCase().includes(search),
      );
    }
    if (startDate) {
      const s = new Date(startDate).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= s);
    }
    if (endDate) {
      const en = new Date(endDate).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= en);
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const entries = filtered.slice(start, start + limit);

    return HttpResponse.json({ entries, total, page, limit });
  }),

  // Users
  http.get(`${API}/users`, () => {
    return HttpResponse.json(usersState);
  }),

  http.post(`${API}/users`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const username = String(body.username || '').trim().toLowerCase();
    if (!username) return HttpResponse.json({ message: 'Username required' }, { status: 400 });
    if (usersState.some((u) => u.username.toLowerCase() === username)) {
      return HttpResponse.json({ message: 'Username already taken' }, { status: 409 });
    }
    const email = String(body.email || '').trim().toLowerCase();
    if (email && usersState.some((u) => u.email.toLowerCase() === email)) {
      return HttpResponse.json({ message: 'Email already in use' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const newUser = {
      id: 'u-' + Date.now(),
      username,
      firstName: String(body.firstName || ''),
      lastName: String(body.lastName || ''),
      email,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      role: body.role,
      groupId: typeof body.groupId === 'string' ? body.groupId : undefined,
      parentId: typeof body.parentId === 'string' ? body.parentId : undefined,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      isActive: true,
      mustChangePassword: true,    // new accounts are forced through Phase 6 first-login
      createdAt: now,
      updatedAt: now,
    } as typeof usersState[number];
    usersState.push(newUser);

    const actor = resolveActor(typeof body.createdById === 'string' ? body.createdById : undefined);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      userId: actor.id,
      userName: actor.name,
      details: `Created ${String(body.role)} account for ${newUser.firstName} ${newUser.lastName} (@${newUser.username})`,
      after: { role: newUser.role, parentId: newUser.parentId, groupId: newUser.groupId },
      timestamp: now,
    });

    return HttpResponse.json(newUser, { status: 201 });
  }),

  // PUT /users/:id — partial update (firstName, lastName, email, phone, role,
  // parentId, etc.). Username is changed via the dedicated /username endpoint.
  // USER-1: diff before/after; emit a paired role_change row when role
  // differs and a group_assignment row when parent/group differs. Strip
  // isActive — soft-delete must go through /deactivate so the audit row
  // reflects intent, not a back-door PUT.
  http.put(`${API}/users/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const before = usersState[idx];
    // Sanitize body — never let username/id/createdAt or status flags sneak
    // in via the generic PUT (USER-1).
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.username;
    delete sanitized.createdAt;
    delete sanitized.isActive;       // force soft-delete through /deactivate
    delete sanitized.mustChangePassword;
    delete sanitized.actorId;
    const updated = { ...before, ...sanitized, updatedAt: new Date().toISOString() };
    usersState[idx] = updated as typeof usersState[number];
    const actor = resolveActor(typeof body.actorId === 'string' ? body.actorId : undefined);
    const now = new Date().toISOString();

    // Role change row
    if (before.role !== updated.role) {
      mockAuditLog.push({
        id: 'al-' + Date.now() + '-rc',
        action: 'role_change',
        entityType: 'role_change',
        entityId: updated.id,
        userId: actor.id,
        userName: actor.name,
        details: `Role for @${updated.username}: ${before.role} → ${updated.role}`,
        before: { role: before.role },
        after: { role: updated.role },
        timestamp: now,
      });
    }
    // Parent/group reassignment row
    if (before.parentId !== updated.parentId || before.groupId !== updated.groupId) {
      mockAuditLog.push({
        id: 'al-' + Date.now() + '-ga',
        action: 'reassign',
        entityType: 'group_assignment',
        entityId: updated.id,
        userId: actor.id,
        userName: actor.name,
        details: `Reassignment for @${updated.username}: parent ${before.parentId ?? '∅'} → ${updated.parentId ?? '∅'}`,
        before: { parentId: before.parentId, groupId: before.groupId },
        after: { parentId: updated.parentId, groupId: updated.groupId },
        timestamp: now,
      });
    }
    // Generic safe-fields update row (always emit so the page-level summary
    // shows that the record was touched even when nothing privileged moved).
    mockAuditLog.push({
      id: 'al-' + Date.now() + '-uu',
      action: 'update',
      entityType: 'user',
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      details: `Updated profile for @${updated.username}`,
      before: {
        firstName: before.firstName,
        lastName: before.lastName,
        email: before.email,
        phone: before.phone,
        avatarUrl: before.avatarUrl,
      },
      after: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      },
      timestamp: now,
    });
    return HttpResponse.json(updated);
  }),

  http.post(`${API}/users/:id/deactivate`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    usersState[idx] = { ...usersState[idx], isActive: false, updatedAt: new Date().toISOString() };
    const actor = resolveActor(body.actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'delete',     // closest existing action; entityType disambiguates
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actor.id,
      userName: actor.name,
      details: `Deactivated ${usersState[idx].firstName} ${usersState[idx].lastName} (@${usersState[idx].username})`,
      before: { isActive: true },
      after: { isActive: false },
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(usersState[idx]);
  }),

  http.post(`${API}/users/:id/restore`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    usersState[idx] = { ...usersState[idx], isActive: true, updatedAt: new Date().toISOString() };
    const actor = resolveActor(body.actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'restore',
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actor.id,
      userName: actor.name,
      details: `Restored ${usersState[idx].firstName} ${usersState[idx].lastName} (@${usersState[idx].username})`,
      before: { isActive: false },
      after: { isActive: true },
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(usersState[idx]);
  }),

  // POST /users/:id/reset-password — generates a one-time temp password,
  // forces a change on first login. Returns the temp password ONCE so the
  // resetter can hand it off (or read it from a future email).
  http.post(`${API}/users/:id/reset-password`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const adj = ['Bright', 'Quiet', 'Eager', 'Kind', 'Steady', 'Bold', 'Humble'];
    const noun = ['River', 'Mountain', 'Lantern', 'Harbor', 'Garden', 'Compass', 'Anchor'];
    const tempPassword =
      adj[Math.floor(Math.random() * adj.length)] +
      noun[Math.floor(Math.random() * noun.length)] +
      (Math.floor(Math.random() * 90) + 10);
    usersState[idx] = {
      ...usersState[idx],
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    };
    const actor = resolveActor(body.actorId);
    // AUDIT-1/BE-9: use entityType='password_reset' + action='reset_password'
    // so a Reports-tab filter for password resets can isolate them. The
    // audit row never carries the temp password.
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'reset_password',
      entityType: 'password_reset',
      entityId: usersState[idx].id,
      userId: actor.id,
      userName: actor.name,
      details: `Reset password for @${usersState[idx].username}`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json({ tempPassword, user: usersState[idx] });
  }),

  // PUT /users/:id/tags — replace the user's tag set.
  // AUDIT-4: emit ONE entry per added/removed tag (entityType 'tag',
  // action 'tag_grant' / 'tag_revoke') so a future filter for tag-grant
  // history can return precise matches. entityId is the tag id.
  http.put(`${API}/users/:id/tags`, async ({ request, params }) => {
    const body = (await request.json()) as { tags: string[]; actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const before = usersState[idx].tags ?? [];
    const beforeSet = new Set(before);
    const afterSet = new Set(tags);
    const added = tags.filter((t) => !beforeSet.has(t));
    const removed = before.filter((t) => !afterSet.has(t));
    usersState[idx] = { ...usersState[idx], tags, updatedAt: new Date().toISOString() };
    const actor = resolveActor(body.actorId);
    const username = usersState[idx].username;
    const now = new Date().toISOString();
    let seq = 0;
    for (const tag of added) {
      mockAuditLog.push({
        id: 'al-' + Date.now() + '-tg' + (seq++),
        action: 'tag_grant',
        entityType: 'tag',
        entityId: tag,
        userId: actor.id,
        userName: actor.name,
        details: `Granted tag '${tag}' to @${username}`,
        after: { userId: usersState[idx].id, tag },
        timestamp: now,
      });
    }
    for (const tag of removed) {
      mockAuditLog.push({
        id: 'al-' + Date.now() + '-tr' + (seq++),
        action: 'tag_revoke',
        entityType: 'tag',
        entityId: tag,
        userId: actor.id,
        userName: actor.name,
        details: `Revoked tag '${tag}' from @${username}`,
        before: { userId: usersState[idx].id, tag },
        timestamp: now,
      });
    }
    return HttpResponse.json(usersState[idx]);
  }),

  // PUT /users/:id/username — rename with collision check (case-insensitive).
  http.put(`${API}/users/:id/username`, async ({ request, params }) => {
    const body = (await request.json()) as { username: string; actorId?: string };
    const desired = String(body.username || '').trim().toLowerCase();
    if (!desired) return HttpResponse.json({ message: 'Username required' }, { status: 400 });
    if (!/^[a-z0-9_.-]{3,32}$/.test(desired)) {
      return HttpResponse.json(
        { message: 'Use 3-32 chars: a-z, 0-9, dot, dash, underscore' },
        { status: 400 },
      );
    }
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const taken = usersState.some(
      (u) => u.id !== params.id && u.username.toLowerCase() === desired,
    );
    if (taken) return HttpResponse.json({ message: 'Username already taken' }, { status: 409 });
    const previousUsername = usersState[idx].username;
    usersState[idx] = { ...usersState[idx], username: desired, updatedAt: new Date().toISOString() };
    const actor = resolveActor(body.actorId);
    // AUDIT-1: dedicated entityType='username_change' + action='rename'.
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'rename',
      entityType: 'username_change',
      entityId: usersState[idx].id,
      userId: actor.id,
      userName: actor.name,
      details: `Username @${previousUsername} → @${desired}`,
      before: { username: previousUsername },
      after: { username: desired },
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(usersState[idx]);
  }),
];
