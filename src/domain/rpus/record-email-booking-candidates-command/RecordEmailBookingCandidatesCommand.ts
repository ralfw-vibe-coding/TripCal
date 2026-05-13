import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type {
  EmailBookingCandidateExtractedV1,
  EmailPartKind,
  EmailPartProcessedV1,
  EmailPartReceivedV1Payload,
} from "../../events/events";
import { emailBookingCandidateExtractedV1, emailPartProcessedV1, emailPartReceivedV1 } from "../../events/eventTypes";
import type { ExtractedBooking } from "../../model";

export type RecordEmailBookingCandidatesCommandRequest = {
  originalMessageId: string;
  partId: string;
  partKind: EmailPartKind;
  documentTextRecordedId?: string;
  documentFileUploadedId?: string;
  fileName?: string;
  bookings: ExtractedBooking[];
  extractedAt: string;
};

export type RecordEmailBookingCandidatesCommandResponse =
  | {
      status: "succeeded";
      candidateExtractedIds: string[];
      duplicate: false;
    }
  | {
      status: "already_recorded";
      candidateExtractedIds: string[];
      duplicate: true;
    }
  | {
      status: "failed";
      reason: "email_part_not_found";
    };

export class RecordEmailBookingCandidatesCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: RecordEmailBookingCandidatesCommandRequest): Promise<RecordEmailBookingCandidatesCommandResponse> {
    const part = await this.findPart(request.partId);
    if (!part) {
      return { status: "failed", reason: "email_part_not_found" };
    }

    const existing = await this.findProcessedPart(request.partId);
    if (existing) {
      return {
        status: "already_recorded",
        candidateExtractedIds: readCandidateIds(existing),
        duplicate: true,
      };
    }

    const candidateEvents: EmailBookingCandidateExtractedV1[] = request.bookings.map((booking) => ({
      eventType: emailBookingCandidateExtractedV1,
      payload: {
        id: this.idGenerator.newId(),
        originalMessageId: request.originalMessageId,
        partId: request.partId,
        partKind: request.partKind,
        documentTextRecordedId: request.documentTextRecordedId ?? "",
        documentFileUploadedId: normalizeOptionalText(request.documentFileUploadedId),
        fileName: normalizeOptionalText(request.fileName),
        booking,
        extractedAt: request.extractedAt,
      },
    }));

    const processedEvent: EmailPartProcessedV1 = {
      eventType: emailPartProcessedV1,
      payload: {
        id: this.idGenerator.newId(),
        originalMessageId: request.originalMessageId,
        partId: request.partId,
        documentTextRecordedId: normalizeOptionalText(request.documentTextRecordedId),
        candidateExtractedIds: candidateEvents.map((event) => event.payload.id),
        processedAt: request.extractedAt,
      },
    };

    await this.eventStore.append([...candidateEvents, processedEvent]);

    return {
      status: "succeeded",
      candidateExtractedIds: candidateEvents.map((event) => event.payload.id),
      duplicate: false,
    };
  }

  private async findPart(partId: string): Promise<EmailPartReceivedV1Payload | undefined> {
    const result = await this.eventStore.query(createFilter([emailPartReceivedV1]));
    const event = result.events.find((record) => record.eventType === emailPartReceivedV1 && record.payload.partId === partId);
    return event?.payload as EmailPartReceivedV1Payload | undefined;
  }

  private async findProcessedPart(partId: string): Promise<EventRecord | undefined> {
    const result = await this.eventStore.query(createFilter([emailPartProcessedV1]));
    return result.events.find((record) => record.eventType === emailPartProcessedV1 && record.payload.partId === partId);
  }
}

function readCandidateIds(record: EventRecord): string[] {
  const ids = record.payload.candidateExtractedIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
