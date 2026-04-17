import type { Booking } from '../types';
import { formatHour12 } from './date';

/**
 * Compute 30-minute time slots for a given day and mark which are occupied
 * by existing bookings in a specific room.
 */
export interface TimeSlot {
  label: string; // "09:00"
  hour: number;
  minute: number;
  start: Date;
  end: Date; // start + 30 min
  occupied: boolean;
  occupiedBy?: string; // booking title
}

export function getDaySlots(
  date: Date,
  roomId: string,
  bookings: Booking[],
  startHour = 8,
  endHour = 24, // exclusive; last slot starts at 23:30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Filter bookings to the target day + room
  const dayBookings = bookings.filter((b) => {
    if (b.roomId !== roomId) return false;
    const bs = new Date(b.startTime);
    return bs >= dayStart && bs < dayEnd;
  });

  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      const slotStart = new Date(date);
      slotStart.setHours(h, m, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      const conflict = dayBookings.find((b) => {
        const bs = new Date(b.startTime).getTime();
        const be = new Date(b.endTime).getTime();
        return bs < slotEnd.getTime() && be > slotStart.getTime();
      });

      slots.push({
        label: formatHour12(h, m),
        hour: h,
        minute: m,
        start: slotStart,
        end: slotEnd,
        occupied: !!conflict,
        occupiedBy: conflict?.title,
      });
    }
  }

  return slots;
}

/**
 * Returns true if the room has any free slot on the given day.
 */
export function roomHasAvailability(date: Date, roomId: string, bookings: Booking[]): boolean {
  return getDaySlots(date, roomId, bookings).some((s) => !s.occupied);
}

/**
 * Count of free slots on the day for summary display.
 */
export function roomFreeSlotCount(date: Date, roomId: string, bookings: Booking[]): number {
  return getDaySlots(date, roomId, bookings).filter((s) => !s.occupied).length;
}

/**
 * Given a start slot, find which consecutive slots are free for a duration.
 * Used to grey out slots that can't fit a multi-slot booking.
 */
export function canFitDuration(
  startIndex: number,
  slots: TimeSlot[],
  durationMinutes: number,
): boolean {
  const slotsNeeded = Math.ceil(durationMinutes / 30);
  for (let i = 0; i < slotsNeeded; i++) {
    const slot = slots[startIndex + i];
    if (!slot || slot.occupied) return false;
  }
  return true;
}
