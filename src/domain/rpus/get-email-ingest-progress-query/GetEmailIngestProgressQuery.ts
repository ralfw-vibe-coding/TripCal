import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { EmailPartProcessedV1Payload, EmailPartReceivedV1Payload } from "../../events/events";
import { emailIngestGatheredV1, emailPartProcessedV1, emailPartReceivedV1 } from "../../events/eventTypes";

export type GetEmailIngestProgressQueryRequest = {
  originalMessageId: string;
};

export type GetEmailIngestProgressQueryResponse = {
  originalMessageId: string;
  expectedPartCount: number;
  receivedPartCount: number;
  processedPartCount: number;
  complete: boolean;
  gathered: boolean;
};

export class GetEmailIngestProgressQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(request: GetEmailIngestProgressQueryRequest): Promise<GetEmailIngestProgressQueryResponse> {
    const result = await this.eventStore.query(createFilter([emailPartReceivedV1, emailPartProcessedV1, emailIngestGatheredV1]));
    const received = result.events
      .filter((event) => event.eventType === emailPartReceivedV1 && event.payload.originalMessageId === request.originalMessageId)
      .map((event) => event.payload as EmailPartReceivedV1Payload);
    const processed = result.events
      .filter((event) => event.eventType === emailPartProcessedV1 && event.payload.originalMessageId === request.originalMessageId)
      .map((event) => event.payload as EmailPartProcessedV1Payload);
    const gathered = result.events.some(
      (event) => event.eventType === emailIngestGatheredV1 && event.payload.originalMessageId === request.originalMessageId,
    );

    const expectedPartCount = Math.max(1, ...received.map((part) => part.partCount));
    const receivedPartIds = new Set(received.map((part) => part.partId));
    const processedPartIds = new Set(processed.map((part) => part.partId));

    return {
      originalMessageId: request.originalMessageId,
      expectedPartCount,
      receivedPartCount: receivedPartIds.size,
      processedPartCount: processedPartIds.size,
      complete: processedPartIds.size >= expectedPartCount,
      gathered,
    };
  }
}
