import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type {
  BookingExtractedFromDocumentTextV1Payload,
  BookingAssignedToTripV1Payload,
  BookingDeletedV1Payload,
  DocumentFileUploadedV1Payload,
  DocumentTextRecordedV1Payload,
  TripCreatedV1Payload,
} from "../../events/events";
import {
  bookingAssignedToTripV1,
  bookingDeletedV1,
  bookingExtractedFromDocumentTextV1,
  documentFileUploadedV1,
  documentTextRecordedV1,
  tripCreatedV1,
} from "../../events/eventTypes";
import type { CalendarBooking } from "../../model";
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
        bookingAssignedToTripV1,
      ]),
    );
    const documentTexts = mapDocumentTexts(result.events);
    const documentFiles = mapDocumentFiles(result.events);
    const trips = mapTrips(result.events);
    const assignedTrips = mapAssignedTrips(result.events);
    const deletedBookingIds = mapDeletedBookingIds(result.events);
    const bookings = result.events
      .filter((event) => event.eventType === bookingExtractedFromDocumentTextV1)
      .filter((event) => !deletedBookingIds.has(String(event.payload.id)))
      .map((event) => toCalendarBooking(event, documentTexts, documentFiles, trips, assignedTrips, this.travelerResolver))
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
  trips: Map<string, TripCreatedV1Payload>,
  assignedTrips: Map<string, string>,
  travelerResolver: TravelerResolver,
): CalendarBooking {
  const payload = event.payload as BookingExtractedFromDocumentTextV1Payload;
  const documentText = documentTexts.get(payload.documentTextRecordedId);
  const documentFile =
    documentText?.source === "file" ? documentFiles.get(documentText.documentFileUploadedId) : undefined;
  const resolvedTravelers = travelerResolver.resolve(payload.travelers);
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
    title: payload.title,
    type: payload.type,
    serviceIdentifier: payload.serviceIdentifier,
    operator: payload.operator,
    status: payload.status,
    start: payload.start,
    end: payload.end,
    from: payload.from,
    to: payload.to,
    travelers: resolvedTravelers.travelers.length > 0 ? resolvedTravelers.travelers : payload.travelers,
    rawTravelers: payload.rawTravelers ?? payload.travelers,
    details: payload.details,
    processedAt: payload.extractedAt,
    trip: trip
      ? {
          tripCreatedId: trip.id,
          shortCode: trip.shortCode,
          color: trip.color,
          owner: trip.owner,
        }
      : undefined,
  };
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

function mapTrips(events: EventRecord[]): Map<string, TripCreatedV1Payload> {
  const trips = new Map<string, TripCreatedV1Payload>();
  for (const event of events) {
    if (event.eventType === tripCreatedV1) {
      const payload = event.payload as TripCreatedV1Payload;
      trips.set(payload.id, payload);
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

function compareCalendarBookings(a: CalendarBooking, b: CalendarBooking): number {
  return startTime(a) - startTime(b) || a.title.localeCompare(b.title);
}

function startTime(booking: CalendarBooking): number {
  const value = booking.start.value;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
