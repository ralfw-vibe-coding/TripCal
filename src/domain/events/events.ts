import type { Event } from "@ricofritzsche/eventstore";
import type { BookingDateTime, BookingPlace, BookingStatus, BookingType } from "../model";
import {
  bookingDeletedV1,
  bookingExtractedFromDocumentTextV1,
  documentFileUploadedV1,
  documentTextRecordedV1,
} from "./eventTypes";

export type DocumentTextRecordedV1Payload =
  | {
      id: string;
      source: "text" | "image";
      text: string;
      recordedAt: string;
    }
  | {
      id: string;
      source: "file";
      documentFileUploadedId: string;
      text: string;
      recordedAt: string;
    };

export type DocumentTextRecordedV1 = Event & {
  eventType: typeof documentTextRecordedV1;
  payload: DocumentTextRecordedV1Payload;
};

export type DocumentFileUploadedV1Payload = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string;
};

export type DocumentFileUploadedV1 = Event & {
  eventType: typeof documentFileUploadedV1;
  payload: DocumentFileUploadedV1Payload;
};

export type BookingExtractedFromDocumentTextV1Payload = {
  id: string;
  documentTextRecordedId: string;
  title: string;
  type: BookingType;
  serviceIdentifier?: string;
  operator?: string;
  status: Extract<BookingStatus, "needs_review">;
  start: BookingDateTime;
  end?: BookingDateTime;
  from?: BookingPlace;
  to?: BookingPlace;
  travelers: string[];
  rawTravelers?: string[];
  details: string;
  extractedAt: string;
};

export type BookingExtractedFromDocumentTextV1 = Event & {
  eventType: typeof bookingExtractedFromDocumentTextV1;
  payload: BookingExtractedFromDocumentTextV1Payload;
};

export type BookingDeletedV1Payload = {
  id: string;
  bookingExtractedId: string;
  deletedAt: string;
};

export type BookingDeletedV1 = Event & {
  eventType: typeof bookingDeletedV1;
  payload: BookingDeletedV1Payload;
};

export type TripCalEvent =
  | DocumentTextRecordedV1
  | DocumentFileUploadedV1
  | BookingExtractedFromDocumentTextV1
  | BookingDeletedV1;

export function isDocumentTextRecordedV1(event: Event): event is DocumentTextRecordedV1 {
  return event.eventType === documentTextRecordedV1;
}

export function isDocumentFileUploadedV1(event: Event): event is DocumentFileUploadedV1 {
  return event.eventType === documentFileUploadedV1;
}

export function isBookingExtractedFromDocumentTextV1(
  event: Event,
): event is BookingExtractedFromDocumentTextV1 {
  return event.eventType === bookingExtractedFromDocumentTextV1;
}

export function isBookingDeletedV1(event: Event): event is BookingDeletedV1 {
  return event.eventType === bookingDeletedV1;
}
