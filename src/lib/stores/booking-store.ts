import { create } from 'zustand';
import type { Booking } from '../types';

type CalendarView = 'day' | 'week' | 'month';

interface BookingState {
  selectedDate: Date;
  view: CalendarView;
  selectedAreaId: string | null;
  selectedBooking: Booking | null;
  isBookingModalOpen: boolean;
  bookingSlot: { roomId: string; start: string; end: string } | null;

  setDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  setAreaId: (id: string) => void;
  openBookingModal: (slot?: { roomId: string; start: string; end: string }) => void;
  openEditModal: (booking: Booking) => void;
  closeBookingModal: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedDate: new Date(),
  view: 'day',
  selectedAreaId: null,
  selectedBooking: null,
  isBookingModalOpen: false,
  bookingSlot: null,

  setDate: (date) => set({ selectedDate: date }),
  setView: (view) => set({ view }),
  setAreaId: (id) => set({ selectedAreaId: id }),
  openBookingModal: (slot) => set({ isBookingModalOpen: true, bookingSlot: slot || null, selectedBooking: null }),
  openEditModal: (booking) => set({ isBookingModalOpen: true, selectedBooking: booking, bookingSlot: null }),
  closeBookingModal: () => set({ isBookingModalOpen: false, selectedBooking: null, bookingSlot: null }),
}));
