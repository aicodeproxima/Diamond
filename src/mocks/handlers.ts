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

export const handlers = [
  // Auth
  http.post(`${API}/login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    const user = usersState.find((u) => u.username === body.username);
    if (!user) return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    // Seeded users use 'admin'; users created via the registry wizard
    // accept any non-empty password (prototype — Mike's backend will own
    // real password storage).
    const isSeeded = mockUsers.some((u) => u.id === user.id);
    if (isSeeded && body.password !== 'admin') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    if (!isSeeded && !body.password) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
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
    const newSlot = {
      id: 'bs-' + Date.now(),
      isActive: true,
      createdAt: new Date().toISOString(),
      ...body,
    } as typeof blockedSlotsState[number];
    blockedSlotsState.push(newSlot);
    return HttpResponse.json(newSlot, { status: 201 });
  }),

  http.put(`${API}/blocked-slots/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = blockedSlotsState.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const updated = { ...blockedSlotsState[idx], ...body };
    blockedSlotsState[idx] = updated as typeof blockedSlotsState[number];
    return HttpResponse.json(updated);
  }),

  http.delete(`${API}/blocked-slots/:id`, ({ params }) => {
    const idx = blockedSlotsState.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    // Soft-delete via isActive=false (consistent with PERMISSIONS.md rule).
    blockedSlotsState[idx] = { ...blockedSlotsState[idx], isActive: false };
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

  http.delete(`${API}/bookings/:id`, ({ params }) => {
    const idx = bookingsState.findIndex((b) => b.id === params.id);
    if (idx !== -1) bookingsState.splice(idx, 1);
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

    const creatorId = typeof body.createdById === 'string' ? body.createdById : 'unknown';
    const creator = usersState.find((u) => u.id === creatorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      userId: creatorId,
      userName: creator ? `${creator.firstName} ${creator.lastName}`.trim() || creator.username : creatorId,
      details: `Created ${String(body.role)} account for ${newUser.firstName} ${newUser.lastName} (@${newUser.username})`,
      timestamp: now,
    });

    return HttpResponse.json(newUser, { status: 201 });
  }),

  // PUT /users/:id — partial update (firstName, lastName, email, phone, role,
  // parentId, etc.). Username is changed via the dedicated /username endpoint.
  http.put(`${API}/users/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    // Sanitize body — never let username/id/createdAt sneak in via update.
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.username;
    delete sanitized.createdAt;
    const updated = { ...usersState[idx], ...sanitized, updatedAt: new Date().toISOString() };
    usersState[idx] = updated as typeof usersState[number];
    return HttpResponse.json(updated);
  }),

  http.post(`${API}/users/:id/deactivate`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    usersState[idx] = { ...usersState[idx], isActive: false, updatedAt: new Date().toISOString() };
    const actorId = body.actorId ?? 'unknown';
    const actor = usersState.find((u) => u.id === actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'delete',     // closest existing action; entityType disambiguates
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actorId,
      userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.username : actorId,
      details: `Deactivated ${usersState[idx].firstName} ${usersState[idx].lastName} (@${usersState[idx].username})`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(usersState[idx]);
  }),

  http.post(`${API}/users/:id/restore`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    usersState[idx] = { ...usersState[idx], isActive: true, updatedAt: new Date().toISOString() };
    const actorId = body.actorId ?? 'unknown';
    const actor = usersState.find((u) => u.id === actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actorId,
      userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.username : actorId,
      details: `Restored ${usersState[idx].firstName} ${usersState[idx].lastName} (@${usersState[idx].username})`,
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
    const actorId = body.actorId ?? 'unknown';
    const actor = usersState.find((u) => u.id === actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actorId,
      userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.username : actorId,
      details: `Reset password for @${usersState[idx].username}`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json({ tempPassword, user: usersState[idx] });
  }),

  // PUT /users/:id/tags — replace the user's tag set.
  http.put(`${API}/users/:id/tags`, async ({ request, params }) => {
    const body = (await request.json()) as { tags: string[]; actorId?: string };
    const idx = usersState.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const before = usersState[idx].tags ?? [];
    usersState[idx] = { ...usersState[idx], tags, updatedAt: new Date().toISOString() };
    const actorId = body.actorId ?? 'unknown';
    const actor = usersState.find((u) => u.id === actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actorId,
      userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.username : actorId,
      details: `Tags for @${usersState[idx].username}: [${before.join(', ')}] → [${tags.join(', ')}]`,
      timestamp: new Date().toISOString(),
    });
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
    const actorId = body.actorId ?? 'unknown';
    const actor = usersState.find((u) => u.id === actorId);
    mockAuditLog.push({
      id: 'al-' + Date.now(),
      action: 'update',
      entityType: 'user',
      entityId: usersState[idx].id,
      userId: actorId,
      userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.username : actorId,
      details: `Username @${previousUsername} → @${desired}`,
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(usersState[idx]);
  }),
];
