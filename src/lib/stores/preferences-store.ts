'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'default' | 'ocean' | 'purple' | 'forest' | 'sunset' | 'rose' | 'marble' | 'starfield';
export type Language = 'en' | 'es';
export type CalendarView = 'day' | 'week' | 'month';
export type TimeFormat = '12h' | '24h';

export interface NotificationPreferences {
  bookingConfirmations: boolean;
  bookingCancellations: boolean;
  contactStageChanges: boolean;
  weeklySummary: boolean;
}

interface PreferencesState {
  colorTheme: ColorTheme;
  language: Language;
  calendarDefaultView: CalendarView;
  timeFormat: TimeFormat;
  notifications: NotificationPreferences;
  profilePhotoBase64: string | null;

  setColorTheme: (theme: ColorTheme) => void;
  setLanguage: (lang: Language) => void;
  setCalendarDefaultView: (view: CalendarView) => void;
  setTimeFormat: (fmt: TimeFormat) => void;
  setNotification: (key: keyof NotificationPreferences, value: boolean) => void;
  setProfilePhoto: (base64: string | null) => void;
}

/**
 * Applies the color theme to the `<html>` element so CSS selectors
 * like `.dark[data-theme="ocean"]` can override custom properties.
 */
export function applyThemeToDOM(theme: ColorTheme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (theme === 'default') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      colorTheme: 'default',
      language: 'en',
      calendarDefaultView: 'day',
      timeFormat: '12h',
      notifications: {
        bookingConfirmations: true,
        bookingCancellations: true,
        contactStageChanges: true,
        weeklySummary: false,
      },
      profilePhotoBase64: null,

      setColorTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ colorTheme: theme });
      },
      setLanguage: (lang) => set({ language: lang }),
      setCalendarDefaultView: (view) => set({ calendarDefaultView: view }),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setNotification: (key, value) =>
        set({ notifications: { ...get().notifications, [key]: value } }),
      setProfilePhoto: (base64) => set({ profilePhotoBase64: base64 }),
    }),
    {
      name: 'diamond-preferences',
      version: 1,
    },
  ),
);
