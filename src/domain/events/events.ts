import type { Event } from "@ricofritzsche/eventstore";
import type { BookingDateTime, BookingPlace, BookingStatus, BookingType } from "../model";
import { bookingExtractedFromDocumentTextV1, documentTextRecordedV1 } from "./eventTypes";

export type DocumentTextRecordedV1Payload =
  | {
      id: string;
      source: "manual_text";
      text: string;
      recordedAt: string;
    }
  | {
      id: string;
      source: "uploaded_file";
      documentFileUploadedId: string;
      text: string;
      recordedAt: string;
    };

export type DocumentTextRecordedV1 = Event & {
  eventType: typeof documentTextRecordedV1;
  payload: DocumentTextRecordedV1Payload;
};

export type BookingExtractedFromDocumentTextV1Payload = {
  id: string;
  documentTextRecordedId: string;
  title: string;
  type: BookingType;
  status: Extract<BookingStatus, "needs_review">;
  start: BookingDateTime;
  end?: BookingDateTime;
  from?: BookingPlace;
  to?: BookingPlace;
  travelers: string[];
  details: string;
  extractedAt: string;
};

export type BookingExtractedFromDocumentTextV1 = Event & {
  eventType: typeof bookingExtractedFromDocumentTextV1;
  payload: BookingExtractedFromDocumentTextV1Payload;
};

export type TripCalEvent = DocumentTextRecordedV1 | BookingExtractedFromDocumentTextV1;

export function isDocumentTextRecordedV1(event: Event): event is DocumentTextRecordedV1 {
  return event.eventType === documentTextRecordedV1;
}

export function isBookingExtractedFromDocumentTextV1(
  event: Event,
): event is BookingExtractedFromDocumentTextV1 {
  return event.eventType === bookingExtractedFromDocumentTextV1;
}

