import type { EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { DocumentFileUploadedV1 } from "../../events/events";
import { documentFileUploadedV1 } from "../../events/eventTypes";

export type RecordDocumentFileUploadedCommandRequest = {
  source?: "upload" | "email";
  emailIngestedId?: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string;
};

export type RecordDocumentFileUploadedCommandResponse =
  | {
      status: "succeeded";
      documentFileUploadedId: string;
    }
  | {
      status: "failed";
      reason: "missing_file_name" | "missing_storage_key" | "missing_email_reference";
    };

export class RecordDocumentFileUploadedCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
  ) {}

  async process(request: RecordDocumentFileUploadedCommandRequest): Promise<RecordDocumentFileUploadedCommandResponse> {
    if (request.originalFileName.trim().length === 0) {
      return { status: "failed", reason: "missing_file_name" };
    }
    if (request.storageKey.trim().length === 0) {
      return { status: "failed", reason: "missing_storage_key" };
    }
    if (request.source === "email" && !request.emailIngestedId?.trim()) {
      return { status: "failed", reason: "missing_email_reference" };
    }

    const event: DocumentFileUploadedV1 = {
      eventType: documentFileUploadedV1,
      payload:
        request.source === "email"
          ? {
              id: this.idGenerator.newId(),
              source: "email",
              emailIngestedId: request.emailIngestedId ?? "",
              originalFileName: request.originalFileName,
              mimeType: request.mimeType,
              sizeBytes: request.sizeBytes,
              storageKey: request.storageKey,
              uploadedAt: request.uploadedAt,
            }
          : {
              id: this.idGenerator.newId(),
              source: "upload",
              originalFileName: request.originalFileName,
              mimeType: request.mimeType,
              sizeBytes: request.sizeBytes,
              storageKey: request.storageKey,
              uploadedAt: request.uploadedAt,
            },
    };

    await this.eventStore.append([event]);

    return {
      status: "succeeded",
      documentFileUploadedId: event.payload.id,
    };
  }
}
