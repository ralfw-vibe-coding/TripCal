import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { BookingStatusChangedV1 } from "../../events/events";
import {
  bookingDeletedV1,
  bookingExtractedFromDocumentTextV1,
  bookingStatusChangedV1,
} from "../../events/eventTypes";
import type { BookingStatus } from "../../model";

export type ChangeBookingStatusCommandRequest = {
  bookingExtractedId: string;
  status: BookingStatus;
};

export type ChangeBookingStatusCommandResponse =
  | {
      status: "succeeded";
      bookingStatusChangedId: string;
    }
  | {
      status: "failed";
      reason: "missing_booking" | "invalid_status" | "booking_not_found" | "already_deleted";
    };

export class ChangeBookingStatusCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: ChangeBookingStatusCommandRequest): Promise<ChangeBookingStatusCommandResponse> {
    const bookingExtractedId = request.bookingExtractedId.trim();
    if (!bookingExtractedId) return { status: "failed", reason: "missing_booking" };
    if (request.status !== "inbox" && request.status !== "reviewed") {
      return { status: "failed", reason: "invalid_status" };
    }

    const contextFilter = createFilter([bookingExtractedFromDocumentTextV1, bookingDeletedV1, bookingStatusChangedV1], [
      { id: bookingExtractedId },
      { bookingExtractedId },
    ]);
    const context = await this.eventStore.query(contextFilter);
    const bookingExists = context.events.some(
      (event) => event.eventType === bookingExtractedFromDocumentTextV1 && event.payload.id === bookingExtractedId,
    );
    if (!bookingExists) return { status: "failed", reason: "booking_not_found" };

    const alreadyDeleted = context.events.some(
      (event) => event.eventType === bookingDeletedV1 && event.payload.bookingExtractedId === bookingExtractedId,
    );
    if (alreadyDeleted) return { status: "failed", reason: "already_deleted" };

    const event: BookingStatusChangedV1 = {
      eventType: bookingStatusChangedV1,
      payload: {
        id: this.idGenerator.newId(),
        bookingExtractedId,
        status: request.status,
        changedAt: this.clock.now().toISOString(),
      },
    };

    await this.eventStore.append([event], contextFilter, context.maxSequenceNumber);
    return { status: "succeeded", bookingStatusChangedId: event.payload.id };
  }
}
