'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTimeSlots, format, isSameDay, parseISO } from '@/lib/utils/date';
import { BookingCard } from './BookingCard';
import type { Booking, Room } from '@/lib/types';

interface DayViewProps {
  date: Date;
  rooms: Room[];
  bookings: Booking[];
  onSlotClick: (roomId: string, date: Date, time24: string) => void;
  onBookingClick: (booking: Booking) => void;
}

const START_HOUR = 8;
const END_HOUR = 23;
const SLOT_HEIGHT = 48;

export function DayView({ date, rooms, bookings, onSlotClick, onBookingClick }: DayViewProps) {
  const timeSlots = useMemo(() => getTimeSlots(START_HOUR, END_HOUR), []);

  const getBookingsForRoom = (roomId: string) =>
    bookings.filter((b) => isSameDay(parseISO(b.startTime), date) && b.roomId === roomId);

  const getBookingPosition = (booking: Booking) => {
    const start = parseISO(booking.startTime);
    const end = parseISO(booking.endTime);
    const startMin = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const duration = (end.getTime() - start.getTime()) / 60000;
    return { top: (startMin / 30) * SLOT_HEIGHT, height: (duration / 30) * SLOT_HEIGHT };
  };

  const isSlotOccupied = (roomId: string, hour: number, minute: number) => {
    return bookings.some((b) => {
      if (b.roomId !== roomId) return false;
      const bs = parseISO(b.startTime);
      if (!isSameDay(bs, date)) return false;
      const be = parseISO(b.endTime);
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
      return bs.getTime() < slotEnd.getTime() && be.getTime() > slotStart.getTime();
    });
  };

  return (
    <div data-calendar-surface="grid" className="overflow-auto rounded-lg border border-border bg-card">
      <div className="min-w-[600px]">
        {/* Room headers */}
        <div data-calendar-surface="header" className="sticky top-0 z-10 grid border-b border-border bg-card" style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}>
          <div className="border-r border-border p-3 text-center">
            <div className="text-sm font-semibold">{format(date, 'EEE')}</div>
            <div className="text-lg font-bold">{format(date, 'MMM d')}</div>
          </div>
          {rooms.map((room) => (
            <div key={room.id} className="border-r border-border p-3 text-center last:border-r-0">
              <div className="text-sm font-semibold">{room.name}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="relative grid" style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}>
          {/* Time column */}
          <div className="border-r border-border">
            {timeSlots.map((slot) => (
              <div key={slot.key} className="flex h-12 items-start justify-end border-b border-border/50 pr-2 pt-0.5 text-xs text-muted-foreground">
                {!slot.isHalfHour ? slot.label : ''}
              </div>
            ))}
          </div>

          {/* Room columns */}
          {rooms.map((room) => (
            <div key={room.id} className="relative border-r border-border last:border-r-0">
              {timeSlots.map((slot) => {
                const occupied = isSlotOccupied(room.id, slot.hour, slot.minute);
                return (
                  <button
                    key={slot.key}
                    type="button"
                    disabled={occupied}
                    onClick={() => onSlotClick(room.id, date, slot.key)}
                    title={occupied ? 'Slot taken' : `Click to book ${slot.label}`}
                    className={cn(
                      'group relative block h-12 w-full border-b border-border/30 transition-colors',
                      !occupied && 'hover:bg-primary/10 cursor-pointer',
                      occupied && 'cursor-default',
                    )}
                  >
                    {!occupied && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="rounded-full bg-primary text-primary-foreground p-1 shadow-lg">
                          <Plus className="h-3 w-3" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
              <div className="absolute inset-0 pointer-events-none">
                {getBookingsForRoom(room.id).map((booking) => {
                  const pos = getBookingPosition(booking);
                  return (
                    <div
                      key={booking.id}
                      className="pointer-events-auto absolute inset-x-1"
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <BookingCard booking={booking} onClick={onBookingClick} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
