import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { BookingDeletedV1 } from "../../events/events";
import { bookingDeletedV1, bookingExtractedFromDocumentTextV1 } from "../../events/eventTypes";

export type DeleteBookingCommandRequest = {
  bookingExtractedId: string;
};

export type DeleteBookingCommandResponse =
  | {
      status: "succeeded";
      bookingDeletedId: string;
    }
  | {
      status: "failed";
      reason: "booking_not_found" | "already_deleted";
    };

export class DeleteBookingCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: DeleteBookingCommandRequest): Promise<DeleteBookingCommandResponse> {
    const contextFilter = createFilter([bookingExtractedFromDocumentTextV1, bookingDeletedV1], [
      { id: request.bookingExtractedId },
      { bookingExtractedId: request.bookingExtractedId },
    ]);
    const context = await this.eventStore.query(contextFilter);
    const bookingExists = context.events.some(
      (event) =>
        event.eventType === bookingExtractedFromDocumentTextV1 && event.payload.id === request.bookingExtractedId,
    );
    if (!bookingExists) {
      return { status: "failed", reason: "booking_not_found" };
    }

    const alreadyDeleted = context.events.some(
      (event) =>
        event.eventType === bookingDeletedV1 && event.payload.bookingExtractedId === request.bookingExtractedId,
    );
    if (alreadyDeleted) {
      return { status: "failed", reason: "already_deleted" };
    }

    const event: BookingDeletedV1 = {
      eventType: bookingDeletedV1,
      payload: {
        id: this.idGenerator.newId(),
        bookingExtractedId: request.bookingExtractedId,
        deletedAt: this.clock.now().toISOString(),
      },
    };

    await this.eventStore.append([event], contextFilter, context.maxSequenceNumber);

    return {
      status: "succeeded",
      bookingDeletedId: event.payload.id,
    };
  }
}
