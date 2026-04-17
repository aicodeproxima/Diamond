'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { BOOKING_TYPE_CONFIG } from '@/lib/types';
import type { Booking } from '@/lib/types';

interface MonthViewProps {
  date: Date;
  bookings: Booking[];
  onDayClick: (date: Date) => void;
  onBookingClick: (booking: Booking) => void;
}

export function MonthView({ date, bookings, onDayClick, onBookingClick }: MonthViewProps) {
  const today = new Date();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [date]);

  const getBookingsForDay = (day: Date) =>
    bookings.filter((b) => isSameDay(parseISO(b.startTime), day));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayBookings = getBookingsForDay(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, date);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] cursor-pointer border-b border-r border-border/50 p-1.5 transition-colors hover:bg-accent/30',
                !isCurrentMonth && 'opacity-40'
              )}
              onClick={() => onDayClick(day)}
            >
              <div className={cn(
                'mb-1 flex h-7 w-7 items-center justify-center rounded-full text-sm',
                isToday && 'bg-primary text-primary-foreground font-bold'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayBookings.slice(0, 3).map((booking) => {
                  const config = BOOKING_TYPE_CONFIG[booking.type];
                  return (
                    <button
                      key={booking.id}
                      onClick={(e) => { e.stopPropagation(); onBookingClick(booking); }}
                      className={cn(
                        'w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium border',
                        config.bgColor, config.color
                      )}
                    >
                      {format(parseISO(booking.startTime), 'h:mm a').toLowerCase()} {booking.title}
                    </button>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{dayBookings.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
