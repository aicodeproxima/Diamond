import { api } from './client';
import type { Area, Booking, BookingFormData } from '../types';

export const bookingsApi = {
  getAreas() {
    return api.get<Area[]>('/areas');
  },
  getBookings(params: { start: string; end: string; areaId?: string; roomId?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<Booking[]>(`/bookings?${qs}`);
  },
  getBooking(id: string) {
    return api.get<Booking>(`/bookings/${id}`);
  },
  createBooking(data: BookingFormData) {
    return api.post<Booking>('/bookings', data);
  },
  updateBooking(id: string, data: Partial<BookingFormData>) {
    return api.put<Booking>(`/bookings/${id}`, data);
  },
  deleteBooking(id: string) {
    return api.delete<void>(`/bookings/${id}`);
  },
  cancelBooking(id: string, reason: string) {
    return api.post<Booking>(`/bookings/${id}/cancel`, { reason });
  },
  restoreBooking(id: string) {
    return api.post<Booking>(`/bookings/${id}/restore`);
  },
};
