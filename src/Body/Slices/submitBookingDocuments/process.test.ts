import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  Event,
  EventFilter,
  EventQuery,
  EventStore,
  EventSubscription,
  HandleEvents,
  QueryResult
} from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";

import { createDependencies } from "../../../Head/Application/createDependencies.js";
import { createProcessor } from "../../Processor/createProcessor.js";

class InMemoryEventStore implements EventStore {
  private readonly events: Event[] = [];

  async query(_filterCriteria: EventQuery | EventFilter): Promise<QueryResult> {
    return {
      events: [],
      maxSequenceNumber: this.events.length
    };
  }

  async append(
    events: Event[],
    _filterCriteria?: EventQuery | EventFilter,
    _expectedMaxSequenceNumber?: number
  ): Promise<void> {
    this.events.push(...events);
  }

  async subscribe(_handle: HandleEvents): Promise<EventSubscription> {
    throw new Error("subscribe is not implemented in tests");
  }

  recordedEvents(): Event[] {
    return this.events;
  }
}

describe("submitBookingDocuments", () => {
  it("stores documents and appends documentStored events", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "tripcal-"));
    const eventStore = new InMemoryEventStore();
    const processor = createProcessor(
      createDependencies({
        eventStore,
        storageRootDirectory: rootDirectory
      })
    );

    const response = await processor.submitBookingDocuments({
      documents: [
        {
          contentType: "text/plain",
          originalFileName: "hotel.txt",
          storageSource: "upload",
          content: Buffer.from("booking content", "utf8")
        }
      ]
    });

    expect(response).toEqual({
      success: true,
      documentStoredIds: expect.any(Array)
    });

    const [storedEvent] = eventStore.recordedEvents();
    expect(storedEvent.eventType).toBe("documentStored");
    expect(storedEvent.payload).toMatchObject({
      documentStoredId: expect.any(String),
      originalFileName: "hotel.txt",
      contentType: "text/plain",
      storageSource: "upload"
    });

    const storageKey = storedEvent.payload.storageKey;
    expect(typeof storageKey).toBe("string");

    const storedContent = await readFile(join(rootDirectory, storageKey as string), "utf8");
    expect(storedContent).toBe("booking content");
  });
});
