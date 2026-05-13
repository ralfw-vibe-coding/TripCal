import type { Event } from "@ricofritzsche/eventstore";
import type {
  BookingCorrectionPatch,
  BookingDateTime,
  BookingPlace,
  BookingStatus,
  BookingType,
  ExtractedBooking,
  TripCorrectionPatch,
} from "../model";
import {
  bookingDeletedV1,
  bookingAssignedToTripV1,
  bookingCorrectedV1,
  emailBookingCandidateExtractedV1,
  bookingExtractedFromDocumentTextV1,
  bookingStatusChangedV1,
  documentFileUploadedV1,
  documentTextRecordedV1,
  emailIngestGatheredV1,
  emailIngestedV1,
  emailPartProcessedV1,
  emailPartReceivedV1,
  tripCorrectedV1,
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

export type EmailPartKind = "body" | "attachment";

export type EmailPartReceivedV1Payload = {
  id: string;
  originalMessageId: string;
  messageId: string;
  partId: string;
  partIndex: number;
  partCount: number;
  partKind: EmailPartKind;
  from?: string;
  subject?: string;
  receivedAt?: string;
  fileName?: string;
  ingestedAt: string;
};

export type EmailPartReceivedV1 = Event & {
  eventType: typeof emailPartReceivedV1;
  payload: EmailPartReceivedV1Payload;
};

export type EmailBookingCandidateExtractedV1Payload = {
  id: string;
  originalMessageId: string;
  partId: string;
  partKind: EmailPartKind;
  documentTextRecordedId: string;
  documentFileUploadedId?: string;
  fileName?: string;
  booking: ExtractedBooking;
  extractedAt: string;
};

export type EmailBookingCandidateExtractedV1 = Event & {
  eventType: typeof emailBookingCandidateExtractedV1;
  payload: EmailBookingCandidateExtractedV1Payload;
};

export type EmailPartProcessedV1Payload = {
  id: string;
  originalMessageId: string;
  partId: string;
  documentTextRecordedId?: string;
  candidateExtractedIds: string[];
  processedAt: string;
};

export type EmailPartProcessedV1 = Event & {
  eventType: typeof emailPartProcessedV1;
  payload: EmailPartProcessedV1Payload;
};

export type EmailIngestGatheredV1Payload = {
  id: string;
  originalMessageId: string;
  bookingExtractedIds: string[];
  discardedCandidateIds: string[];
  gatheredAt: string;
};

export type EmailIngestGatheredV1 = Event & {
  eventType: typeof emailIngestGatheredV1;
  payload: EmailIngestGatheredV1Payload;
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

export type TripCorrectedV1Payload = {
  id: string;
  tripCreatedId: string;
  correctedAt: string;
  patch: TripCorrectionPatch;
};

export type TripCorrectedV1 = Event & {
  eventType: typeof tripCorrectedV1;
  payload: TripCorrectedV1Payload;
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
  | EmailPartReceivedV1
  | EmailBookingCandidateExtractedV1
  | EmailPartProcessedV1
  | EmailIngestGatheredV1
  | BookingExtractedFromDocumentTextV1
  | BookingDeletedV1
  | TripCreatedV1
  | TripCorrectedV1
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

export function isEmailPartReceivedV1(event: Event): event is EmailPartReceivedV1 {
  return event.eventType === emailPartReceivedV1;
}

export function isEmailBookingCandidateExtractedV1(event: Event): event is EmailBookingCandidateExtractedV1 {
  return event.eventType === emailBookingCandidateExtractedV1;
}

export function isEmailPartProcessedV1(event: Event): event is EmailPartProcessedV1 {
  return event.eventType === emailPartProcessedV1;
}

export function isEmailIngestGatheredV1(event: Event): event is EmailIngestGatheredV1 {
  return event.eventType === emailIngestGatheredV1;
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

export function isTripCorrectedV1(event: Event): event is TripCorrectedV1 {
  return event.eventType === tripCorrectedV1;
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
