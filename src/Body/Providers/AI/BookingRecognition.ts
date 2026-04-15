import type { Booking, BookingType, Location, TimeRange } from "../../../Data/Booking.js";

export type RecognizedBooking = Omit<Booking, "bookingRegisteredId" | "documentStoredId">;

export interface BookingRecognition {
  recognizeBookings(input: { text: string }): Promise<RecognizedBooking[]>;
}

export class StubBookingRecognition implements BookingRecognition {
  async recognizeBookings(): Promise<RecognizedBooking[]> {
    return [];
  }
}

