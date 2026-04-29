import type { EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { DocumentTextRecordedV1 } from "../../events/events";
import { documentTextRecordedV1 } from "../../events/eventTypes";

export type SubmitDocumentTextCommandRequest =
  | {
      source: "text" | "image";
      text: string;
      recordedAt: string;
    }
  | {
      source: "file";
      documentFileUploadedId: string;
      text: string;
      recordedAt: string;
    }
  | {
      source: "email";
      emailIngestedId: string;
      text: string;
      recordedAt: string;
    };

export type SubmitDocumentTextCommandResponse =
  | {
      status: "succeeded";
      documentTextRecordedId: string;
    }
  | {
      status: "failed";
      reason: "empty_text";
    };

export class SubmitDocumentTextCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: SubmitDocumentTextCommandRequest): Promise<SubmitDocumentTextCommandResponse> {
    const text = request.text.trim();
    if (text.length === 0) {
      return { status: "failed", reason: "empty_text" };
    }

    const event: DocumentTextRecordedV1 = {
      eventType: documentTextRecordedV1,
      payload:
        request.source === "file"
          ? {
              id: this.idGenerator.newId(),
              source: "file",
              documentFileUploadedId: request.documentFileUploadedId,
              text,
              recordedAt: request.recordedAt,
            }
          : request.source === "email"
            ? {
                id: this.idGenerator.newId(),
                source: "email",
                emailIngestedId: request.emailIngestedId,
                text,
                recordedAt: request.recordedAt,
              }
          : {
              id: this.idGenerator.newId(),
              source: request.source,
              text,
              recordedAt: request.recordedAt,
            },
    };

    await this.eventStore.append([event]);

    return {
      status: "succeeded",
      documentTextRecordedId: event.payload.id,
    };
  }
}
