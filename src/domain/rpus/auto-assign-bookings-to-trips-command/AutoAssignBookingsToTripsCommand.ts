import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type {
  BookingAssignedToTripV1,
  BookingAssignedToTripV1Payload,
  BookingExtractedFromDocumentTextV1Payload,
  TripCreatedV1Payload,
} from "../../events/events";
import { bookingAssignedToTripV1, bookingExtractedFromDocumentTextV1, tripCreatedV1 } from "../../events/eventTypes";

export type AutoAssignBookingsToTripsCommandRequest = {
  bookingExtractedIds: string[];
  assignedAt: string;
};

export type AutoAssignBookingsToTripsCommandResponse = {
  status: "succeeded";
  bookingAssignedToTripIds: string[];
  skipped: Array<{
    bookingExtractedId: string;
    reason: "already_assigned" | "booking_not_found" | "no_matching_trip" | "multiple_matching_trips" | "missing_start_date";
  }>;
};

export class AutoAssignBookingsToTripsCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: AutoAssignBookingsToTripsCommandRequest): Promise<AutoAssignBookingsToTripsCommandResponse> {
    const bookingIds = request.bookingExtractedIds.map((id) => id.trim()).filter(Boolean);
    if (bookingIds.length === 0) {
      return { status: "succeeded", bookingAssignedToTripIds: [], skipped: [] };
    }

    const result = await this.eventStore.query(
      createFilter([bookingExtractedFromDocumentTextV1, tripCreatedV1, bookingAssignedToTripV1]),
    );
    const bookings = mapBookings(result.events);
    const trips = mapTrips(result.events);
    const assignedBookingIds = mapAssignedBookingIds(result.events);

    const events: BookingAssignedToTripV1[] = [];
    const skipped: AutoAssignBookingsToTripsCommandResponse["skipped"] = [];

    for (const bookingId of bookingIds) {
      if (assignedBookingIds.has(bookingId)) {
        skipped.push({ bookingExtractedId: bookingId, reason: "already_assigned" });
        continue;
      }

      const booking = bookings.get(bookingId);
      if (!booking) {
        skipped.push({ bookingExtractedId: bookingId, reason: "booking_not_found" });
        continue;
      }

      const bookingStartDate = toDateOnly(booking.start.value);
      if (!bookingStartDate) {
        skipped.push({ bookingExtractedId: bookingId, reason: "missing_start_date" });
        continue;
      }

      const matchingTrips = trips.filter((trip) => trip.startDate <= bookingStartDate && bookingStartDate <= trip.endDate);
      if (matchingTrips.length === 0) {
        skipped.push({ bookingExtractedId: bookingId, reason: "no_matching_trip" });
        continue;
      }
      if (matchingTrips.length > 1) {
        skipped.push({ bookingExtractedId: bookingId, reason: "multiple_matching_trips" });
        continue;
      }

      events.push({
        eventType: bookingAssignedToTripV1,
        payload: {
          id: this.idGenerator.newId(),
          bookingExtractedId: bookingId,
          tripCreatedId: matchingTrips[0].id,
          assignedAt: request.assignedAt,
        },
      });
    }

    await this.eventStore.append(events);

    return {
      status: "succeeded",
      bookingAssignedToTripIds: events.map((event) => event.payload.id),
      skipped,
    };
  }
}

function mapBookings(events: EventRecord[]): Map<string, BookingExtractedFromDocumentTextV1Payload> {
  const bookings = new Map<string, BookingExtractedFromDocumentTextV1Payload>();
  for (const event of events) {
    if (event.eventType === bookingExtractedFromDocumentTextV1) {
      const payload = event.payload as BookingExtractedFromDocumentTextV1Payload;
      bookings.set(payload.id, payload);
    }
  }
  return bookings;
}

function mapTrips(events: EventRecord[]): TripCreatedV1Payload[] {
  return events
    .filter((event) => event.eventType === tripCreatedV1)
    .map((event) => event.payload as TripCreatedV1Payload);
}

function mapAssignedBookingIds(events: EventRecord[]): Set<string> {
  const assignedBookingIds = new Set<string>();
  for (const event of events) {
    if (event.eventType === bookingAssignedToTripV1) {
      const payload = event.payload as BookingAssignedToTripV1Payload;
      assignedBookingIds.add(payload.bookingExtractedId);
    }
  }
  return assignedBookingIds;
}

function toDateOnly(value: string): string | undefined {
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0];
}
