import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type {
  BookingExtractedFromDocumentTextV1Payload,
  BookingAssignedToTripV1Payload,
  BookingCorrectedV1Payload,
  BookingDeletedV1Payload,
  BookingStatusChangedV1Payload,
  DocumentFileUploadedV1Payload,
  DocumentTextRecordedV1Payload,
  TripCorrectedV1Payload,
  TripCreatedV1Payload,
} from "../../events/events";
import {
  bookingAssignedToTripV1,
  bookingCorrectedV1,
  bookingDeletedV1,
  bookingExtractedFromDocumentTextV1,
  bookingStatusChangedV1,
  documentFileUploadedV1,
  documentTextRecordedV1,
  tripCorrectedV1,
  tripCreatedV1,
} from "../../events/eventTypes";
import type { CalendarBooking, CalendarTripReference } from "../../model";
import type { BookingCorrectionPatch, BookingStatus } from "../../model";
import type { TravelerResolver } from "../../../providers/travelers/TravelerResolver";

export type GetBookingCalendarQueryRequest = Record<string, never>;

export type GetBookingCalendarQueryResponse = {
  bookings: CalendarBooking[];
};

export class GetBookingCalendarQuery {
  constructor(
    private readonly eventStore: EventStore,
    private readonly travelerResolver: TravelerResolver,
  ) {}

  async process(_request: GetBookingCalendarQueryRequest = {}): Promise<GetBookingCalendarQueryResponse> {
    const result = await this.eventStore.query(
      createFilter([
        bookingExtractedFromDocumentTextV1,
        bookingDeletedV1,
        documentTextRecordedV1,
        documentFileUploadedV1,
        tripCreatedV1,
        tripCorrectedV1,
        bookingAssignedToTripV1,
        bookingCorrectedV1,
        bookingStatusChangedV1,
      ]),
    );
    const documentTexts = mapDocumentTexts(result.events);
    const documentFiles = mapDocumentFiles(result.events);
    const trips = mapTrips(result.events);
    const assignedTrips = mapAssignedTrips(result.events);
    const corrections = mapBookingCorrections(result.events);
    const statuses = mapBookingStatuses(result.events);
    const deletedBookingIds = mapDeletedBookingIds(result.events);
    const bookings = result.events
      .filter((event) => event.eventType === bookingExtractedFromDocumentTextV1)
      .filter((event) => !deletedBookingIds.has(String(event.payload.id)))
      .map((event) =>
        toCalendarBooking(event, documentTexts, documentFiles, trips, assignedTrips, corrections, statuses, this.travelerResolver),
      )
      .sort(compareCalendarBookings);

    return { bookings };
  }
}

function mapDeletedBookingIds(events: EventRecord[]): Set<string> {
  const deleted = new Set<string>();
  for (const event of events) {
    if (event.eventType === bookingDeletedV1) {
      const payload = event.payload as BookingDeletedV1Payload;
      deleted.add(payload.bookingExtractedId);
    }
  }
  return deleted;
}

function toCalendarBooking(
  event: EventRecord,
  documentTexts: Map<string, DocumentTextRecordedV1Payload>,
  documentFiles: Map<string, DocumentFileUploadedV1Payload>,
  trips: Map<string, CalendarTripReference>,
  assignedTrips: Map<string, string>,
  corrections: Map<string, BookingCorrectionPatch[]>,
  statuses: Map<string, BookingStatus>,
  travelerResolver: TravelerResolver,
): CalendarBooking {
  const payload = event.payload as BookingExtractedFromDocumentTextV1Payload;
  const corrected = applyCorrections(payload, corrections.get(payload.id) ?? []);
  const documentText = documentTexts.get(payload.documentTextRecordedId);
  const documentFile =
    documentText?.source === "file" ? documentFiles.get(documentText.documentFileUploadedId) : undefined;
  const resolvedTravelers = travelerResolver.resolve(corrected.travelers);
  const trip = trips.get(assignedTrips.get(payload.id) ?? "");

  return {
    bookingExtractedId: payload.id,
    documentTextRecordedId: payload.documentTextRecordedId,
    sourceDocument: documentFile
      ? {
          documentFileUploadedId: documentFile.id,
          originalFileName: documentFile.originalFileName,
        }
      : undefined,
    title: corrected.title,
    type: corrected.type,
    serviceIdentifier: corrected.serviceIdentifier,
    operator: corrected.operator,
    status: statuses.get(payload.id) ?? corrected.status,
    start: corrected.start,
    end: corrected.end,
    from: corrected.from,
    to: corrected.to,
    travelers: resolvedTravelers.travelers.length > 0 ? resolvedTravelers.travelers : corrected.travelers,
    rawTravelers: payload.rawTravelers ?? payload.travelers,
    details: corrected.details,
    processedAt: payload.extractedAt,
    trip: trip
      ? {
          tripCreatedId: trip.tripCreatedId,
          shortCode: trip.shortCode,
          color: trip.color,
          owner: trip.owner,
        }
      : undefined,
  };
}

function applyCorrections(
  payload: BookingExtractedFromDocumentTextV1Payload,
  corrections: BookingCorrectionPatch[],
): BookingExtractedFromDocumentTextV1Payload {
  const corrected: BookingExtractedFromDocumentTextV1Payload = { ...payload };
  for (const patch of corrections) {
    if (patch.title !== undefined) corrected.title = patch.title;
    if (patch.type !== undefined) corrected.type = patch.type;
    if (patch.serviceIdentifier !== undefined) corrected.serviceIdentifier = patch.serviceIdentifier ?? undefined;
    if (patch.operator !== undefined) corrected.operator = patch.operator ?? undefined;
    if (patch.start !== undefined) corrected.start = patch.start;
    if (patch.end !== undefined) corrected.end = patch.end ?? undefined;
    if (patch.from !== undefined) corrected.from = patch.from ?? undefined;
    if (patch.to !== undefined) corrected.to = patch.to ?? undefined;
    if (patch.travelers !== undefined) corrected.travelers = patch.travelers;
    if (patch.details !== undefined) corrected.details = patch.details;
  }
  return corrected;
}

function mapBookingStatuses(events: EventRecord[]): Map<string, BookingStatus> {
  const statuses = new Map<string, BookingStatus>();
  for (const event of events) {
    if (event.eventType === bookingStatusChangedV1) {
      const payload = event.payload as BookingStatusChangedV1Payload;
      statuses.set(payload.bookingExtractedId, payload.status);
    }
  }
  return statuses;
}

function mapDocumentTexts(events: EventRecord[]): Map<string, DocumentTextRecordedV1Payload> {
  const documents = new Map<string, DocumentTextRecordedV1Payload>();
  for (const event of events) {
    if (event.eventType === documentTextRecordedV1) {
      const payload = event.payload as DocumentTextRecordedV1Payload;
      documents.set(payload.id, payload);
    }
  }
  return documents;
}

function mapDocumentFiles(events: EventRecord[]): Map<string, DocumentFileUploadedV1Payload> {
  const documents = new Map<string, DocumentFileUploadedV1Payload>();
  for (const event of events) {
    if (event.eventType === documentFileUploadedV1) {
      const payload = event.payload as DocumentFileUploadedV1Payload;
      documents.set(payload.id, payload);
    }
  }
  return documents;
}

function mapTrips(events: EventRecord[]): Map<string, CalendarTripReference> {
  const trips = new Map<string, CalendarTripReference>();
  for (const event of events) {
    if (event.eventType === tripCreatedV1) {
      const payload = event.payload as TripCreatedV1Payload;
      trips.set(payload.id, {
        tripCreatedId: payload.id,
        shortCode: payload.shortCode,
        color: payload.color,
        owner: payload.owner,
      });
    }
    if (event.eventType === tripCorrectedV1) {
      const payload = event.payload as TripCorrectedV1Payload;
      const trip = trips.get(payload.tripCreatedId);
      if (!trip) continue;
      if (payload.patch.shortCode !== undefined) trip.shortCode = payload.patch.shortCode;
      if (payload.patch.owner !== undefined) trip.owner = payload.patch.owner;
    }
  }
  return trips;
}

function mapAssignedTrips(events: EventRecord[]): Map<string, string> {
  const assignments = new Map<string, string>();
  for (const event of events) {
    if (event.eventType === bookingAssignedToTripV1) {
      const payload = event.payload as BookingAssignedToTripV1Payload;
      assignments.set(payload.bookingExtractedId, payload.tripCreatedId);
    }
  }
  return assignments;
}

function mapBookingCorrections(events: EventRecord[]): Map<string, BookingCorrectionPatch[]> {
  const corrections = new Map<string, BookingCorrectionPatch[]>();
  for (const event of events) {
    if (event.eventType === bookingCorrectedV1) {
      const payload = event.payload as BookingCorrectedV1Payload;
      corrections.set(payload.bookingExtractedId, [...(corrections.get(payload.bookingExtractedId) ?? []), payload.patch]);
    }
  }
  return corrections;
}

function compareCalendarBookings(a: CalendarBooking, b: CalendarBooking): number {
  return startTime(a) - startTime(b) || a.title.localeCompare(b.title);
}

function startTime(booking: CalendarBooking): number {
  const value = booking.start.value;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
