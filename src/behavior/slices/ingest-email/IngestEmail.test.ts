import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import { RecordEmailIngestedCommand } from "../../../domain/rpus/record-email-ingested-command/RecordEmailIngestedCommand";
import { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { BookingExtractionProvider } from "../../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { FileStorageProvider } from "../../../providers/file-storage/FileStorageProvider";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { IngestEmail } from "./IngestEmail";

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

const fileStorageProvider: FileStorageProvider = {
  async storeFile(request) {
    return {
      storageKey: `stored-${request.originalFileName}`,
      sizeBytes: Buffer.from(request.dataBase64, "base64").byteLength,
    };
  },
  async readFile() {
    return new Uint8Array();
  },
};

const textExtractionProvider: TextExtractionProvider = {
  async extractText() {
    return { text: "Title: Flug nach Da Nang\nType: flight\nStart: 2026-10-03T08:00:00\nTravelers: Ralf" };
  },
};

const bookingExtractionProvider: BookingExtractionProvider = {
  async extractBookingsFromText() {
    return {
      bookings: [
        {
          title: "Flug nach Da Nang",
          type: "flight",
          start: { value: "2026-10-03T08:00:00", precision: "datetime" },
          travelers: ["Ralf"],
          details: "Flug nach Da Nang",
        },
      ],
    };
  },
};

describe("IngestEmail", () => {
  it("records email text and attachments with references to the ingested email", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["email-1", "email-text-1", "booking-1", "file-1", "file-text-1", "booking-2"]);
    const clock = new FixedClock();
    const sharedFlow = new RecordDocumentTextAndExtractBookings(
      clock,
      new SubmitDocumentTextCommand(eventStore, ids),
      bookingExtractionProvider,
      new RecordExtractedBookingsCommand(eventStore, ids, new TravelerResolver({ RW: ["Ralf"] })),
    );
    const slice = new IngestEmail(
      clock,
      fileStorageProvider,
      textExtractionProvider,
      new RecordEmailIngestedCommand(eventStore, ids),
      new RecordDocumentFileUploadedCommand(eventStore, ids),
      sharedFlow,
    );

    const response = await slice.process({
      messageId: "mail-123",
      from: "airline@example.test",
      subject: "Ihre Buchung",
      receivedAt: "2026-04-28T09:55:00.000Z",
      text: "Title: Hotel\nType: accommodation\nStart: 2026-10-02\nTravelers: Ralf",
      attachments: [
        {
          fileName: "ticket.pdf",
          mimeType: "application/pdf",
          dataBase64: Buffer.from("ticket").toString("base64"),
        },
      ],
    });

    expect(response).toMatchObject({
      status: "accepted",
      emailIngestedId: "email-1",
      duplicate: false,
      documentFileUploadedIds: ["file-1"],
      documentTextRecordedIds: ["email-text-1", "file-text-1"],
      bookingExtractedIds: ["booking-1", "booking-2"],
    });

    const stored = await eventStore.query();
    expect(stored.events.map((event) => event.eventType)).toEqual([
      "EmailIngestedV1",
      "DocumentTextRecordedV1",
      "BookingExtractedFromDocumentTextV1",
      "DocumentFileUploadedV1",
      "DocumentTextRecordedV1",
      "BookingExtractedFromDocumentTextV1",
    ]);
    expect(stored.events[1].payload).toMatchObject({
      source: "email",
      emailIngestedId: "email-1",
    });
    expect(stored.events[3].payload).toMatchObject({
      source: "email",
      emailIngestedId: "email-1",
      originalFileName: "ticket.pdf",
    });
    expect(stored.events[4].payload).toMatchObject({
      source: "file",
      documentFileUploadedId: "file-1",
    });

    const duplicate = await slice.process({
      messageId: "mail-123",
      text: "Title: Duplicate\nStart: 2026-10-04",
      attachments: [],
    });

    expect(duplicate).toMatchObject({
      status: "accepted",
      emailIngestedId: "email-1",
      duplicate: true,
      bookingExtractedIds: [],
    });
  });
});
