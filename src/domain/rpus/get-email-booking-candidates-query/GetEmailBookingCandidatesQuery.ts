import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { EmailPartKind } from "../../events/events";
import { emailBookingCandidateExtractedV1 } from "../../events/eventTypes";
import type { ExtractedBooking } from "../../model";

export type EmailBookingCandidate = {
  candidateExtractedId: string;
  originalMessageId: string;
  partId: string;
  partKind: EmailPartKind;
  documentTextRecordedId: string;
  documentFileUploadedId?: string;
  fileName?: string;
  booking: ExtractedBooking;
  extractedAt: string;
};

export type GetEmailBookingCandidatesQueryRequest = {
  originalMessageId: string;
};

export type GetEmailBookingCandidatesQueryResponse = {
  candidates: EmailBookingCandidate[];
};

export class GetEmailBookingCandidatesQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(request: GetEmailBookingCandidatesQueryRequest): Promise<GetEmailBookingCandidatesQueryResponse> {
    const result = await this.eventStore.query(createFilter([emailBookingCandidateExtractedV1]));
    return {
      candidates: result.events
        .filter((event) => event.eventType === emailBookingCandidateExtractedV1)
        .filter((event) => event.payload.originalMessageId === request.originalMessageId)
        .map((event) => ({
          candidateExtractedId: String(event.payload.id),
          originalMessageId: String(event.payload.originalMessageId),
          partId: String(event.payload.partId),
          partKind: event.payload.partKind === "attachment" ? "attachment" : "body",
          documentTextRecordedId: String(event.payload.documentTextRecordedId),
          documentFileUploadedId: optionalString(event.payload.documentFileUploadedId),
          fileName: optionalString(event.payload.fileName),
          booking: event.payload.booking as ExtractedBooking,
          extractedAt: String(event.payload.extractedAt),
        })),
    };
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
