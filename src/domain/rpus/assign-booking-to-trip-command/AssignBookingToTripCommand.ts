import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { BookingAssignedToTripV1 } from "../../events/events";
import { bookingAssignedToTripV1, bookingExtractedFromDocumentTextV1, tripCreatedV1 } from "../../events/eventTypes";

export type AssignBookingToTripCommandRequest = {
  bookingExtractedId: string;
  tripCreatedId: string;
};

export type AssignBookingToTripCommandResponse =
  | {
      status: "succeeded";
      bookingAssignedToTripId: string;
    }
  | {
      status: "failed";
      reason: "missing_booking" | "missing_trip" | "booking_not_found" | "trip_not_found";
    };

export class AssignBookingToTripCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: AssignBookingToTripCommandRequest): Promise<AssignBookingToTripCommandResponse> {
    const bookingExtractedId = request.bookingExtractedId.trim();
    const tripCreatedId = request.tripCreatedId.trim();

    if (!bookingExtractedId) return { status: "failed", reason: "missing_booking" };
    if (!tripCreatedId) return { status: "failed", reason: "missing_trip" };

    const booking = await this.eventStore.query(createFilter([bookingExtractedFromDocumentTextV1], [{ id: bookingExtractedId }]));
    if (!booking.events.some((event) => event.eventType === bookingExtractedFromDocumentTextV1)) {
      return { status: "failed", reason: "booking_not_found" };
    }

    const trip = await this.eventStore.query(createFilter([tripCreatedV1], [{ id: tripCreatedId }]));
    if (!trip.events.some((event) => event.eventType === tripCreatedV1)) {
      return { status: "failed", reason: "trip_not_found" };
    }

    const event: BookingAssignedToTripV1 = {
      eventType: bookingAssignedToTripV1,
      payload: {
        id: this.idGenerator.newId(),
        bookingExtractedId,
        tripCreatedId,
        assignedAt: this.clock.now().toISOString(),
      },
    };

    await this.eventStore.append([event]);
    return { status: "succeeded", bookingAssignedToTripId: event.payload.id };
  }
}
