import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { EmailIngestedV1, EmailIngestedV1Payload } from "../../events/events";
import { emailIngestedV1 } from "../../events/eventTypes";

export type RecordEmailIngestedCommandRequest = {
  messageId: string;
  from?: string;
  subject?: string;
  receivedAt?: string;
  ingestedAt: string;
};

export type RecordEmailIngestedCommandResponse =
  | {
      status: "succeeded";
      emailIngestedId: string;
      duplicate: false;
    }
  | {
      status: "already_recorded";
      emailIngestedId: string;
      duplicate: true;
    }
  | {
      status: "failed";
      reason: "missing_message_id";
    };

export class RecordEmailIngestedCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: RecordEmailIngestedCommandRequest): Promise<RecordEmailIngestedCommandResponse> {
    const messageId = request.messageId.trim();
    if (messageId.length === 0) {
      return { status: "failed", reason: "missing_message_id" };
    }

    const existing = await this.findExistingEmail(messageId);
    if (existing) {
      return {
        status: "already_recorded",
        emailIngestedId: existing.id,
        duplicate: true,
      };
    }

    const event: EmailIngestedV1 = {
      eventType: emailIngestedV1,
      payload: {
        id: this.idGenerator.newId(),
        messageId,
        from: normalizeOptionalText(request.from),
        subject: normalizeOptionalText(request.subject),
        receivedAt: normalizeOptionalText(request.receivedAt),
        ingestedAt: request.ingestedAt,
      },
    };

    await this.eventStore.append([event]);

    return {
      status: "succeeded",
      emailIngestedId: event.payload.id,
      duplicate: false,
    };
  }

  private async findExistingEmail(messageId: string): Promise<EmailIngestedV1Payload | undefined> {
    const result = await this.eventStore.query(createFilter([emailIngestedV1]));
    const event = result.events.find((record) => hasMessageId(record, messageId));
    return event?.payload as EmailIngestedV1Payload | undefined;
  }
}

function hasMessageId(record: EventRecord, messageId: string): boolean {
  return record.eventType === emailIngestedV1 && String(record.payload.messageId ?? "").trim() === messageId;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
