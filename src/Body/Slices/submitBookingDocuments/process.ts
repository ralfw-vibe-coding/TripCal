import { createEvent } from "../../../Shared/events/createEvent.js";
import { eventTypes } from "../../../Shared/events/eventTypes.js";
import { newId } from "../../../Shared/ids/newId.js";
import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { SubmitBookingDocumentsRequest } from "./Request.js";
import type { SubmitBookingDocumentsResponse } from "./Response.js";

export async function processSubmitBookingDocuments(
  dependencies: ProcessorDependencies,
  request: SubmitBookingDocumentsRequest
): Promise<SubmitBookingDocumentsResponse> {
  if (request.documents.length === 0) {
    return {
      success: false,
      reason: "no documents submitted"
    };
  }

  const events = [];
  const documentStoredIds: string[] = [];

  for (const document of request.documents) {
    const storedFile = await dependencies.storage.store(document.content, {
      contentType: document.contentType,
      originalFileName: document.originalFileName
    });
    const documentStoredId = newId();

    documentStoredIds.push(documentStoredId);
    events.push(
      createEvent(eventTypes.documentStored, {
        documentStoredId,
        storageKey: storedFile.storageKey,
        contentType: document.contentType,
        originalFileName: document.originalFileName,
        storageSource: document.storageSource,
        storedAt: dependencies.clock.now().toISOString()
      })
    );
  }

  await dependencies.eventStore.append(events);

  return {
    success: true,
    documentStoredIds
  };
}

