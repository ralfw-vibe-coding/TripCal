import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { BookingCorrectedV1 } from "../../events/events";
import {
  bookingCorrectedV1,
  bookingDeletedV1,
  bookingExtractedFromDocumentTextV1,
} from "../../events/eventTypes";
import type { BookingCorrectionPatch } from "../../model";

export type CorrectBookingCommandRequest = {
  bookingExtractedId: string;
  patch: BookingCorrectionPatch;
};

export type CorrectBookingCommandResponse =
  | {
      status: "succeeded";
      bookingCorrectedId: string;
    }
  | {
      status: "failed";
      reason: "missing_booking" | "empty_patch" | "booking_not_found" | "already_deleted";
    };

export class CorrectBookingCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: CorrectBookingCommandRequest): Promise<CorrectBookingCommandResponse> {
    const bookingExtractedId = request.bookingExtractedId.trim();
    if (!bookingExtractedId) return { status: "failed", reason: "missing_booking" };
    if (Object.keys(request.patch).length === 0) return { status: "failed", reason: "empty_patch" };

    const contextFilter = createFilter([bookingExtractedFromDocumentTextV1, bookingDeletedV1, bookingCorrectedV1], [
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

    const event: BookingCorrectedV1 = {
      eventType: bookingCorrectedV1,
      payload: {
        id: this.idGenerator.newId(),
        bookingExtractedId,
        correctedAt: this.clock.now().toISOString(),
        patch: request.patch,
      },
    };

    await this.eventStore.append([event], contextFilter, context.maxSequenceNumber);

    return {
      status: "succeeded",
      bookingCorrectedId: event.payload.id,
    };
  }
}
