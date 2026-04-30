import type { Event } from "@ricofritzsche/eventstore";
import type { BookingCorrectionPatch, BookingDateTime, BookingPlace, BookingStatus, BookingType } from "../model";
import {
  bookingDeletedV1,
  bookingAssignedToTripV1,
  bookingCorrectedV1,
  bookingExtractedFromDocumentTextV1,
  bookingStatusChangedV1,
  documentFileUploadedV1,
  documentTextRecordedV1,
  emailIngestedV1,
  tripCreatedV1,
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
    }
  | {
      id: string;
      source: "email";
      emailIngestedId: string;
      text: string;
      recordedAt: string;
    };

export type DocumentTextRecordedV1 = Event & {
  eventType: typeof documentTextRecordedV1;
  payload: DocumentTextRecordedV1Payload;
};

export type DocumentFileUploadedV1Payload =
  | {
      id: string;
      source: "upload";
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      uploadedAt: string;
    }
  | {
      id: string;
      source: "email";
      emailIngestedId: string;
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

export type EmailIngestedV1Payload = {
  id: string;
  messageId: string;
  from?: string;
  subject?: string;
  receivedAt?: string;
  ingestedAt: string;
};

export type EmailIngestedV1 = Event & {
  eventType: typeof emailIngestedV1;
  payload: EmailIngestedV1Payload;
};

export type BookingExtractedFromDocumentTextV1Payload = {
  id: string;
  documentTextRecordedId: string;
  title: string;
  type: BookingType;
  serviceIdentifier?: string;
  operator?: string;
  status: Extract<BookingStatus, "inbox">;
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

export type TripCreatedV1Payload = {
  id: string;
  tripNumber: number;
  shortCode: string;
  title?: string;
  owner: string;
  startDate: string;
  endDate: string;
  color: string;
  createdAt: string;
};

export type TripCreatedV1 = Event & {
  eventType: typeof tripCreatedV1;
  payload: TripCreatedV1Payload;
};

export type BookingAssignedToTripV1Payload = {
  id: string;
  bookingExtractedId: string;
  tripCreatedId: string;
  assignedAt: string;
};

export type BookingAssignedToTripV1 = Event & {
  eventType: typeof bookingAssignedToTripV1;
  payload: BookingAssignedToTripV1Payload;
};

export type BookingCorrectedV1Payload = {
  id: string;
  bookingExtractedId: string;
  correctedAt: string;
  patch: BookingCorrectionPatch;
};

export type BookingCorrectedV1 = Event & {
  eventType: typeof bookingCorrectedV1;
  payload: BookingCorrectedV1Payload;
};

export type BookingStatusChangedV1Payload = {
  id: string;
  bookingExtractedId: string;
  status: BookingStatus;
  changedAt: string;
};

export type BookingStatusChangedV1 = Event & {
  eventType: typeof bookingStatusChangedV1;
  payload: BookingStatusChangedV1Payload;
};

export type TripCalEvent =
  | DocumentTextRecordedV1
  | DocumentFileUploadedV1
  | EmailIngestedV1
  | BookingExtractedFromDocumentTextV1
  | BookingDeletedV1
  | TripCreatedV1
  | BookingAssignedToTripV1
  | BookingCorrectedV1
  | BookingStatusChangedV1;

export function isDocumentTextRecordedV1(event: Event): event is DocumentTextRecordedV1 {
  return event.eventType === documentTextRecordedV1;
}

export function isDocumentFileUploadedV1(event: Event): event is DocumentFileUploadedV1 {
  return event.eventType === documentFileUploadedV1;
}

export function isEmailIngestedV1(event: Event): event is EmailIngestedV1 {
  return event.eventType === emailIngestedV1;
}

export function isBookingExtractedFromDocumentTextV1(
  event: Event,
): event is BookingExtractedFromDocumentTextV1 {
  return event.eventType === bookingExtractedFromDocumentTextV1;
}

export function isBookingDeletedV1(event: Event): event is BookingDeletedV1 {
  return event.eventType === bookingDeletedV1;
}

export function isTripCreatedV1(event: Event): event is TripCreatedV1 {
  return event.eventType === tripCreatedV1;
}

export function isBookingAssignedToTripV1(event: Event): event is BookingAssignedToTripV1 {
  return event.eventType === bookingAssignedToTripV1;
}

export function isBookingCorrectedV1(event: Event): event is BookingCorrectedV1 {
  return event.eventType === bookingCorrectedV1;
}

export function isBookingStatusChangedV1(event: Event): event is BookingStatusChangedV1 {
  return event.eventType === bookingStatusChangedV1;
}
