import { createFilter } from "@ricofritzsche/eventstore";
import type { ProcessorRuntime } from "./createProcessor";
import type { DocumentFileUploadedV1Payload } from "../domain/events/events";
import { documentFileUploadedV1 } from "../domain/events/eventTypes";

export type ReadDocumentFileResponse =
  | {
      status: "found";
      originalFileName: string;
      mimeType: string;
      bytes: Uint8Array;
    }
  | {
      status: "not_found";
    };

export async function readDocumentFile(
  runtime: ProcessorRuntime,
  documentFileUploadedId: string,
): Promise<ReadDocumentFileResponse> {
  const result = await runtime.eventStore.query(createFilter([documentFileUploadedV1], [{ id: documentFileUploadedId }]));
  const event = result.events.find((record) => record.eventType === documentFileUploadedV1);
  if (!event) {
    return { status: "not_found" };
  }

  const payload = event.payload as DocumentFileUploadedV1Payload;
  const bytes = await runtime.fileStorageProvider.readFile(payload.storageKey);

  return {
    status: "found",
    originalFileName: payload.originalFileName,
    mimeType: payload.mimeType,
    bytes,
  };
}
