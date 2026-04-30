import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import type { BookingExtractedFromDocumentTextV1 } from "../../events/events";
import { bookingExtractedFromDocumentTextV1, documentTextRecordedV1 } from "../../events/eventTypes";
import type { ExtractedBooking } from "../../model";

export type RecordExtractedBookingsCommandRequest = {
  documentTextRecordedId: string;
  bookings: ExtractedBooking[];
  extractedAt: string;
};

export type RecordExtractedBookingsCommandResponse =
  | {
      status: "succeeded";
      bookingExtractedIds: string[];
    }
  | {
      status: "failed";
      reason: "document_text_recorded_not_found" | "no_bookings";
    };

export class RecordExtractedBookingsCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly travelerResolver: TravelerResolver,
  ) {}

  async process(request: RecordExtractedBookingsCommandRequest): Promise<RecordExtractedBookingsCommandResponse> {
    if (request.bookings.length === 0) {
      return { status: "failed", reason: "no_bookings" };
    }

    const documentTextFilter = createFilter([documentTextRecordedV1], [{ id: request.documentTextRecordedId }]);
    const documentTextResult = await this.eventStore.query(documentTextFilter);
    if (documentTextResult.events.length === 0) {
      return { status: "failed", reason: "document_text_recorded_not_found" };
    }

    const events: BookingExtractedFromDocumentTextV1[] = request.bookings.map((booking) => {
      const resolvedTravelers = this.travelerResolver.resolve(booking.travelers);
      return {
        eventType: bookingExtractedFromDocumentTextV1,
        payload: {
          id: this.idGenerator.newId(),
          documentTextRecordedId: request.documentTextRecordedId,
          title: booking.title,
          type: booking.type,
          serviceIdentifier: booking.serviceIdentifier,
          operator: booking.operator,
          status: "inbox",
          start: booking.start,
          end: booking.end,
          from: booking.from,
          to: booking.to,
          travelers: resolvedTravelers.travelers,
          rawTravelers: resolvedTravelers.rawTravelers,
          details: booking.details,
          extractedAt: request.extractedAt,
        },
      };
    });

    await this.eventStore.append(events, documentTextFilter, documentTextResult.maxSequenceNumber);

    return {
      status: "succeeded",
      bookingExtractedIds: events.map((event) => event.payload.id),
    };
  }
}
