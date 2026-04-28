import type { ExtractedBooking } from "../../domain/model";

export type ExtractBookingsFromTextRequest = {
  text: string;
};

export type ExtractBookingsFromTextResponse = {
  bookings: ExtractedBooking[];
  warnings?: string[];
};

export interface BookingExtractionProvider {
  extractBookingsFromText(request: ExtractBookingsFromTextRequest): Promise<ExtractBookingsFromTextResponse>;
}

