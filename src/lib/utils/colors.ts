import { BookingType, BOOKING_TYPE_CONFIG } from '../types';

export function getBookingColor(type: BookingType) {
  return BOOKING_TYPE_CONFIG[type];
}

export const BOOKING_COLORS_CSS: Record<BookingType, string> = {
  [BookingType.UNBAPTIZED_CONTACT]: '#3b82f6',
  [BookingType.BAPTIZED_PERSECUTED]: '#ef4444',
  [BookingType.UNBAPTIZED_ZOOM]: '#06b6d4',
  [BookingType.BAPTIZED_IN_PERSON]: '#22c55e',
  [BookingType.BAPTIZED_ZOOM]: '#14b8a6',
  [BookingType.GROUP_ACTIVITIES]: '#a855f7',
  [BookingType.TEAM_ACTIVITIES]: '#f59e0b',
};
