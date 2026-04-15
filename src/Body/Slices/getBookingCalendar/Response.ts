import type { Booking } from "../../../Data/Booking.js";

export type BookingCalendarDay = {
  date: string;
  bookings: Booking[];
};

export type GetBookingCalendarResponse = {
  days: BookingCalendarDay[];
};

