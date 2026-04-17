import {
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns';

export {
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isWithinInterval,
  parseISO,
};

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

/**
 * Format a 24-hour slot as 12-hour with am/pm.
 * e.g. 0 → "12:00 am", 13 → "1:00 pm", 23.5 → "11:30 pm"
 */
export function formatHour12(hour: number, minute = 0): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${h}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export interface GridSlot {
  /** Raw 24h key, e.g. "08:00" — stable identifier */
  key: string;
  /** 12-hour display label, e.g. "8:00 am" */
  label: string;
  hour: number;
  minute: number;
  isHalfHour: boolean;
}

export function getTimeSlots(startHour = 8, endHour = 23): GridSlot[] {
  const slots: GridSlot[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      slots.push({
        key: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        label: formatHour12(h, m),
        hour: h,
        minute: m,
        isHalfHour: m === 30,
      });
    }
  }
  return slots;
}

export function formatTimeRange(start: string, end: string): string {
  return `${format(parseISO(start), 'h:mm aaa')} - ${format(parseISO(end), 'h:mm aaa')}`;
}

export function getBookingPosition(startTime: string, endTime: string, dayStart = 7) {
  const start = parseISO(startTime);
  const end = parseISO(endTime);
  const startMinutes = start.getHours() * 60 + start.getMinutes() - dayStart * 60;
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  return { top: startMinutes, height: durationMinutes };
}
