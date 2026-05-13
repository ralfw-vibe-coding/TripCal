import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { EmailPartKind, EmailPartReceivedV1, EmailPartReceivedV1Payload } from "../../events/events";
import { emailPartReceivedV1 } from "../../events/eventTypes";

export type RecordEmailPartReceivedCommandRequest = {
  originalMessageId: string;
  messageId: string;
  partId: string;
  partIndex: number;
  partCount: number;
  partKind: EmailPartKind;
  from?: string;
  subject?: string;
  receivedAt?: string;
  fileName?: string;
  ingestedAt: string;
};

export type RecordEmailPartReceivedCommandResponse =
  | {
      status: "succeeded";
      emailPartReceivedId: string;
      duplicate: false;
    }
  | {
      status: "already_recorded";
      emailPartReceivedId: string;
      duplicate: true;
    }
  | {
      status: "failed";
      reason: "missing_part_id" | "invalid_part_count";
    };

export class RecordEmailPartReceivedCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: RecordEmailPartReceivedCommandRequest): Promise<RecordEmailPartReceivedCommandResponse> {
    const partId = request.partId.trim();
    const originalMessageId = request.originalMessageId.trim();
    if (!partId || !originalMessageId) {
      return { status: "failed", reason: "missing_part_id" };
    }
    if (!Number.isInteger(request.partCount) || request.partCount < 1) {
      return { status: "failed", reason: "invalid_part_count" };
    }

    const existing = await this.findExistingPart(partId);
    if (existing) {
      return {
        status: "already_recorded",
        emailPartReceivedId: existing.id,
        duplicate: true,
      };
    }

    const event: EmailPartReceivedV1 = {
      eventType: emailPartReceivedV1,
      payload: {
        id: this.idGenerator.newId(),
        originalMessageId,
        messageId: request.messageId.trim() || partId,
        partId,
        partIndex: Math.max(0, request.partIndex),
        partCount: request.partCount,
        partKind: request.partKind,
        from: normalizeOptionalText(request.from),
        subject: normalizeOptionalText(request.subject),
        receivedAt: normalizeOptionalText(request.receivedAt),
        fileName: normalizeOptionalText(request.fileName),
        ingestedAt: request.ingestedAt,
      },
    };

    await this.eventStore.append([event]);

    return {
      status: "succeeded",
      emailPartReceivedId: event.payload.id,
      duplicate: false,
    };
  }

  private async findExistingPart(partId: string): Promise<EmailPartReceivedV1Payload | undefined> {
    const result = await this.eventStore.query(createFilter([emailPartReceivedV1]));
    const event = result.events.find((record) => hasPartId(record, partId));
    return event?.payload as EmailPartReceivedV1Payload | undefined;
  }
}

function hasPartId(record: EventRecord, partId: string): boolean {
  return record.eventType === emailPartReceivedV1 && String(record.payload.partId ?? "").trim() === partId;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
