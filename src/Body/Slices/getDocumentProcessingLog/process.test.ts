import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";

import { createDependencies } from "../../../Head/Application/createDependencies.js";
import { createEvent } from "../../../Shared/events/createEvent.js";
import { eventTypes } from "../../../Shared/events/eventTypes.js";
import { createProcessor } from "../../Processor/createProcessor.js";

describe("getDocumentProcessingLog", () => {
  it("builds document processing states from document-scoped events", async () => {
    const eventStore = new MemoryEventStore();
    await eventStore.append([
      createEvent(eventTypes.documentStored, {
        documentStoredId: "document-stored-1",
        storageKey: "documents/1.pdf",
        contentType: "application/pdf",
        originalFileName: "hotel.pdf",
        storageSource: "upload",
        storedAt: "2026-04-15T10:00:00.000Z"
      }),
      createEvent(eventTypes.documentStored, {
        documentStoredId: "document-stored-2",
        storageKey: "documents/2.txt",
        contentType: "text/plain",
        originalFileName: "flight.txt",
        storageSource: "upload",
        storedAt: "2026-04-15T10:05:00.000Z"
      }),
      createEvent(eventTypes.documentStored, {
        documentStoredId: "document-stored-3",
        storageKey: "documents/3.png",
        contentType: "image/png",
        originalFileName: "ticket.png",
        storageSource: "clipboard",
        storedAt: "2026-04-15T10:10:00.000Z"
      }),
      createEvent(eventTypes.documentStored, {
        documentStoredId: "document-stored-4",
        storageKey: "documents/4.jpg",
        contentType: "image/jpeg",
        originalFileName: "ferry.jpg",
        storageSource: "upload",
        storedAt: "2026-04-15T10:15:00.000Z"
      }),
      createEvent(eventTypes.analysisStarted, {
        analysisStartedId: "analysis-started-2",
        startedAt: "2026-04-15T10:06:00.000Z",
        scopes: {
          documentStoredId: "document-stored-2"
        }
      }),
      createEvent(eventTypes.analysisStarted, {
        analysisStartedId: "analysis-started-3",
        startedAt: "2026-04-15T10:11:00.000Z",
        scopes: {
          documentStoredId: "document-stored-3"
        }
      }),
      createEvent(eventTypes.bookingRegistered, {
        bookingRegisteredId: "booking-3a",
        type: "flight",
        title: "Flight",
        details: "details",
        time: {
          start: "2026-04-20T10:00:00.000Z",
          end: "2026-04-20T12:00:00.000Z"
        },
        location: {
          from: "Sofia",
          to: "Hamburg"
        },
        scopes: {
          documentStoredId: "document-stored-3",
          analysisStartedId: "analysis-started-3"
        }
      }),
      createEvent(eventTypes.bookingRegistered, {
        bookingRegisteredId: "booking-3b",
        type: "activity",
        title: "Cinema",
        details: "details",
        time: {
          start: "2026-04-21T18:00:00.000Z",
          end: "2026-04-21T18:00:00.000Z"
        },
        location: {
          from: "Hamburg"
        },
        scopes: {
          documentStoredId: "document-stored-3",
          analysisStartedId: "analysis-started-3"
        }
      }),
      createEvent(eventTypes.analysisFinished, {
        analysisFinishedId: "analysis-finished-3",
        finishedAt: "2026-04-15T10:12:00.000Z",
        bookingCount: 2,
        scopes: {
          documentStoredId: "document-stored-3",
          analysisStartedId: "analysis-started-3"
        }
      }),
      createEvent(eventTypes.analysisStarted, {
        analysisStartedId: "analysis-started-4",
        startedAt: "2026-04-15T10:16:00.000Z",
        scopes: {
          documentStoredId: "document-stored-4"
        }
      }),
      createEvent(eventTypes.analysisFailed, {
        analysisFailedId: "analysis-failed-4",
        failedAt: "2026-04-15T10:17:00.000Z",
        reason: "ocr failed",
        scopes: {
          documentStoredId: "document-stored-4",
          analysisStartedId: "analysis-started-4"
        }
      })
    ]);

    const processor = createProcessor(
      createDependencies({
        eventStore
      })
    );

    const response = await processor.getDocumentProcessingLog({});

    expect(response).toEqual({
      documents: [
        {
          documentStoredId: "document-stored-1",
          originalFileName: "hotel.pdf",
          contentType: "application/pdf",
          status: "stored",
          storedAt: "2026-04-15T10:00:00.000Z",
          bookingRegisteredIds: []
        },
        {
          documentStoredId: "document-stored-2",
          originalFileName: "flight.txt",
          contentType: "text/plain",
          status: "analyzing",
          storedAt: "2026-04-15T10:05:00.000Z",
          analysisStartedAt: "2026-04-15T10:06:00.000Z",
          bookingRegisteredIds: []
        },
        {
          documentStoredId: "document-stored-3",
          originalFileName: "ticket.png",
          contentType: "image/png",
          status: "analyzed",
          storedAt: "2026-04-15T10:10:00.000Z",
          analysisStartedAt: "2026-04-15T10:11:00.000Z",
          analysisFinishedAt: "2026-04-15T10:12:00.000Z",
          bookingRegisteredIds: ["booking-3a", "booking-3b"]
        },
        {
          documentStoredId: "document-stored-4",
          originalFileName: "ferry.jpg",
          contentType: "image/jpeg",
          status: "failed",
          storedAt: "2026-04-15T10:15:00.000Z",
          analysisStartedAt: "2026-04-15T10:16:00.000Z",
          analysisFailedAt: "2026-04-15T10:17:00.000Z",
          failureReason: "ocr failed",
          bookingRegisteredIds: []
        }
      ]
    });
  });
});
