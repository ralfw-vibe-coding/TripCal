import type { EventStore } from "@ricofritzsche/eventstore";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { DocumentFileUploadedV1 } from "../../events/events";
import { documentFileUploadedV1 } from "../../events/eventTypes";

export type RecordDocumentFileUploadedCommandRequest = {
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
      reason: "missing_file_name" | "missing_storage_key";
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

    const event: DocumentFileUploadedV1 = {
      eventType: documentFileUploadedV1,
      payload: {
        id: this.idGenerator.newId(),
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
