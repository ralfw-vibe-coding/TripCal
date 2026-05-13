import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { EmailIngestGatheredV1, EmailIngestGatheredV1Payload } from "../../events/events";
import { emailIngestGatheredV1 } from "../../events/eventTypes";

export type MarkEmailIngestGatheredCommandRequest = {
  originalMessageId: string;
  bookingExtractedIds: string[];
  discardedCandidateIds: string[];
  gatheredAt: string;
};

export type MarkEmailIngestGatheredCommandResponse =
  | {
      status: "succeeded";
      emailIngestGatheredId: string;
      duplicate: false;
    }
  | {
      status: "already_gathered";
      emailIngestGatheredId: string;
      duplicate: true;
    }
  | {
      status: "failed";
      reason: "missing_original_message_id";
    };

export class MarkEmailIngestGatheredCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: MarkEmailIngestGatheredCommandRequest): Promise<MarkEmailIngestGatheredCommandResponse> {
    const originalMessageId = request.originalMessageId.trim();
    if (!originalMessageId) {
      return { status: "failed", reason: "missing_original_message_id" };
    }

    const existing = await this.findExisting(originalMessageId);
    if (existing) {
      return {
        status: "already_gathered",
        emailIngestGatheredId: existing.id,
        duplicate: true,
      };
    }

    const event: EmailIngestGatheredV1 = {
      eventType: emailIngestGatheredV1,
      payload: {
        id: this.idGenerator.newId(),
        originalMessageId,
        bookingExtractedIds: request.bookingExtractedIds,
        discardedCandidateIds: request.discardedCandidateIds,
        gatheredAt: request.gatheredAt,
      },
    };

    await this.eventStore.append([event]);

    return {
      status: "succeeded",
      emailIngestGatheredId: event.payload.id,
      duplicate: false,
    };
  }

  private async findExisting(originalMessageId: string): Promise<EmailIngestGatheredV1Payload | undefined> {
    const result = await this.eventStore.query(createFilter([emailIngestGatheredV1]));
    const event = result.events.find((record) => hasOriginalMessageId(record, originalMessageId));
    return event?.payload as EmailIngestGatheredV1Payload | undefined;
  }
}

function hasOriginalMessageId(record: EventRecord, originalMessageId: string): boolean {
  return record.eventType === emailIngestGatheredV1 && record.payload.originalMessageId === originalMessageId;
}
