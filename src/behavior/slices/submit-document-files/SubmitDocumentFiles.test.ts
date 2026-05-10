import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import { AutoAssignBookingsToTripsCommand } from "../../../domain/rpus/auto-assign-bookings-to-trips-command/AutoAssignBookingsToTripsCommand";
import { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../../providers/clock/Clock";
import { LocalFileStorageProvider } from "../../../providers/file-storage/LocalFileStorageProvider";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { SubmitDocumentFiles } from "./SubmitDocumentFiles";

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-04-28T10:00:00.000Z");
  }
}

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

const textExtractionProvider: TextExtractionProvider = {
  async extractText() {
    return { text: "Hotel Kyoto from 2026-10-03 to 2026-10-05 for Ralf and Ralfs Frau." };
  },
};

const bookingExtractionProvider: BookingExtractionProvider = {
  async extractBookingsFromText() {
    return {
      bookings: [
        {
          title: "Hotel Kyoto",
          type: "accommodation",
          start: { value: "2026-10-03", precision: "date" },
          end: { value: "2026-10-05", precision: "date" },
          travelers: ["Ralf", "Ralfs Frau"],
          details: "Hotel Kyoto",
        },
      ],
    };
  },
};

const activityLogProvider: ActivityLogProvider = {
  async append() {},
  async listLatest() {
    return [];
  },
};

describe("SubmitDocumentFiles", () => {
  it("stores files, records upload events, and extracts bookings", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["storage-1", "file-event-1", "text-event-1", "booking-event-1"]);
    const storageDir = await mkdtemp(`${tmpdir()}/tripcal-files-`);
    const clock = new FixedClock();
    const sharedFlow = new RecordDocumentTextAndExtractBookings(
      clock,
      activityLogProvider,
      new SubmitDocumentTextCommand(eventStore, ids),
      bookingExtractionProvider,
      new RecordExtractedBookingsCommand(eventStore, ids, new TravelerResolver({ RW: ["Ralf"], AK: ["Ralfs Frau"] })),
      new AutoAssignBookingsToTripsCommand(eventStore, ids),
    );
    const slice = new SubmitDocumentFiles(
      clock,
      activityLogProvider,
      new LocalFileStorageProvider(storageDir, ids),
      textExtractionProvider,
      new RecordDocumentFileUploadedCommand(eventStore, ids),
      sharedFlow,
    );

    const response = await slice.process({
      files: [
        {
          fileName: "hotel.txt",
          mimeType: "text/plain",
          dataBase64: Buffer.from("Hotel booking").toString("base64"),
          dataUrl: "data:text/plain;base64,SG90ZWwgYm9va2luZw==",
        },
      ],
    });

    expect(response).toEqual({
      status: "accepted",
      documentFileUploadedIds: ["file-event-1"],
      documentTextRecordedIds: ["text-event-1"],
      bookingExtractedIds: ["booking-event-1"],
      warnings: undefined,
    });

    const stored = await eventStore.query();
    expect(stored.events.map((event) => event.eventType)).toEqual([
      "DocumentFileUploadedV1",
      "DocumentTextRecordedV1",
      "BookingExtractedFromDocumentTextV1",
    ]);
    expect(stored.events[1].payload.source).toBe("file");
    expect(stored.events[1].payload.documentFileUploadedId).toBe("file-event-1");
  });
});
