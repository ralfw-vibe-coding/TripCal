import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";

import { createDependencies } from "../../../Head/Application/createDependencies.js";
import { eventTypes } from "../../../Shared/events/eventTypes.js";
import { createProcessor } from "../../Processor/createProcessor.js";

describe("submitBookingDocuments", () => {
  it("stores documents and appends documentStored events", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "tripcal-"));
    const eventStore = new MemoryEventStore();
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

    const queryResult = await eventStore.query({
      eventTypes: [eventTypes.documentStored]
    });
    const [storedEvent] = queryResult.events;

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
