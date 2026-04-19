import { createFilter } from "@ricofritzsche/eventstore";

import { eventTypes } from "../../../Shared/events/eventTypes.js";
import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { GetDocumentProcessingLogRequest } from "./Request.js";
import type {
  GetDocumentProcessingLogResponse,
  ProcessedDocumentLogEntry
} from "./Response.js";

export async function processGetDocumentProcessingLog(
  dependencies: ProcessorDependencies,
  _request: GetDocumentProcessingLogRequest
): Promise<GetDocumentProcessingLogResponse> {
  const queryResult = await dependencies.eventStore.query(
    createFilter([
      eventTypes.documentStored,
      eventTypes.analysisStarted,
      eventTypes.analysisFinished,
      eventTypes.analysisFailed,
      eventTypes.bookingRegistered
    ])
  );

  const documentEntries = new Map<string, ProcessedDocumentLogEntry>();

  for (const event of queryResult.events) {
    switch (event.eventType) {
      case eventTypes.documentStored: {
        const documentStoredId = requiredString(event.payload.documentStoredId);

        documentEntries.set(documentStoredId, {
          documentStoredId,
          originalFileName: optionalString(event.payload.originalFileName),
          contentType: requiredString(event.payload.contentType),
          status: "stored",
          storedAt: requiredString(event.payload.storedAt),
          bookingRegisteredIds: []
        });
        break;
      }

      case eventTypes.analysisStarted: {
        const documentStoredId = requiredScopeId(event.payload, "documentStoredId");
        const entry = documentEntries.get(documentStoredId);
        if (!entry) {
          break;
        }

        entry.status = "analyzing";
        entry.analysisStartedAt = requiredString(event.payload.startedAt);
        delete entry.analysisFinishedAt;
        delete entry.analysisFailedAt;
        delete entry.failureReason;
        break;
      }

      case eventTypes.analysisFinished: {
        const documentStoredId = requiredScopeId(event.payload, "documentStoredId");
        const entry = documentEntries.get(documentStoredId);
        if (!entry) {
          break;
        }

        entry.status = "analyzed";
        entry.analysisFinishedAt = requiredString(event.payload.finishedAt);
        delete entry.analysisFailedAt;
        delete entry.failureReason;
        break;
      }

      case eventTypes.analysisFailed: {
        const documentStoredId = requiredScopeId(event.payload, "documentStoredId");
        const entry = documentEntries.get(documentStoredId);
        if (!entry) {
          break;
        }

        entry.status = "failed";
        entry.analysisFailedAt = requiredString(event.payload.failedAt);
        entry.failureReason = requiredString(event.payload.reason);
        break;
      }

      case eventTypes.bookingRegistered: {
        const documentStoredId = requiredScopeId(event.payload, "documentStoredId");
        const entry = documentEntries.get(documentStoredId);
        if (!entry) {
          break;
        }

        entry.bookingRegisteredIds.push(
          requiredString(event.payload.bookingRegisteredId)
        );
        break;
      }
    }
  }

  return {
    documents: [...documentEntries.values()].sort((left, right) =>
      left.storedAt.localeCompare(right.storedAt)
    )
  };
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value === "") {
    throw new Error("expected non-empty string payload value");
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value);
}

function requiredScopeId(
  payload: Record<string, unknown>,
  scopeFieldName: string
): string {
  const scopes = payload.scopes;
  if (!scopes || typeof scopes !== "object") {
    throw new Error("expected scopes payload value");
  }

  return requiredString((scopes as Record<string, unknown>)[scopeFieldName]);
}
