import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { AutoAssignBookingsToTripsCommand } from "../../../domain/rpus/auto-assign-bookings-to-trips-command/AutoAssignBookingsToTripsCommand";
import { GetEmailBookingCandidatesQuery } from "../../../domain/rpus/get-email-booking-candidates-query/GetEmailBookingCandidatesQuery";
import { GetEmailIngestProgressQuery } from "../../../domain/rpus/get-email-ingest-progress-query/GetEmailIngestProgressQuery";
import { MarkEmailIngestGatheredCommand } from "../../../domain/rpus/mark-email-ingest-gathered-command/MarkEmailIngestGatheredCommand";
import { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import { RecordEmailBookingCandidatesCommand } from "../../../domain/rpus/record-email-booking-candidates-command/RecordEmailBookingCandidatesCommand";
import { RecordEmailPartReceivedCommand } from "../../../domain/rpus/record-email-part-received-command/RecordEmailPartReceivedCommand";
import { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
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

const activityLogProvider: ActivityLogProvider = {
  async append() {},
  async listLatest() {
    return [];
  },
};

describe("IngestEmail", () => {
  it("records candidates per email part and gathers final deduplicated bookings after the last part", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds([
      "part-body",
      "email-text-1",
      "candidate-body",
      "processed-body",
      "part-attachment",
      "file-1",
      "file-text-1",
      "candidate-attachment",
      "processed-attachment",
      "booking-1",
      "gathered-1",
    ]);
    const clock = new FixedClock();
    const slice = new IngestEmail(
      clock,
      fileStorageProvider,
      textExtractionProvider,
      bookingExtractionProvider,
      activityLogProvider,
      new RecordEmailPartReceivedCommand(eventStore, ids),
      new RecordDocumentFileUploadedCommand(eventStore, ids),
      new SubmitDocumentTextCommand(eventStore, ids),
      new RecordEmailBookingCandidatesCommand(eventStore, ids),
      new GetEmailIngestProgressQuery(eventStore),
      new GetEmailBookingCandidatesQuery(eventStore),
      new RecordExtractedBookingsCommand(eventStore, ids, new TravelerResolver({ RW: ["Ralf"] })),
      new AutoAssignBookingsToTripsCommand(eventStore, ids),
      new MarkEmailIngestGatheredCommand(eventStore, ids),
    );

    const bodyResponse = await slice.process({
      messageId: "mail-123#body",
      originalMessageId: "mail-123",
      part: {
        originalMessageId: "mail-123",
        partId: "mail-123#body",
        partIndex: 0,
        partCount: 2,
        partKind: "body",
      },
      from: "airline@example.test",
      subject: "Ihre Buchung",
      receivedAt: "2026-04-28T09:55:00.000Z",
      text: "Title: Hotel\nType: accommodation\nStart: 2026-10-02\nTravelers: Ralf",
      attachments: [],
    });

    expect(bodyResponse).toMatchObject({
      status: "accepted",
      emailIngestedId: "part-body",
      duplicate: false,
      gathered: false,
      documentFileUploadedIds: [],
      documentTextRecordedIds: ["email-text-1"],
      bookingExtractedIds: [],
    });

    const attachmentResponse = await slice.process({
      messageId: "mail-123#attachment_0",
      originalMessageId: "mail-123",
      part: {
        originalMessageId: "mail-123",
        partId: "mail-123#attachment_0",
        partIndex: 1,
        partCount: 2,
        partKind: "attachment",
      },
      from: "airline@example.test",
      subject: "Ihre Buchung",
      receivedAt: "2026-04-28T09:55:00.000Z",
      text: "",
      attachments: [
        {
          fileName: "ticket.pdf",
          mimeType: "application/pdf",
          dataBase64: Buffer.from("ticket").toString("base64"),
        },
      ],
    });

    expect(attachmentResponse).toMatchObject({
      status: "accepted",
      emailIngestedId: "part-attachment",
      duplicate: false,
      gathered: true,
      documentFileUploadedIds: ["file-1"],
      documentTextRecordedIds: ["file-text-1"],
      bookingExtractedIds: ["booking-1"],
    });

    const stored = await eventStore.query();
    expect(stored.events.map((event) => event.eventType)).toEqual([
      "EmailPartReceivedV1",
      "DocumentTextRecordedV1",
      "EmailBookingCandidateExtractedV1",
      "EmailPartProcessedV1",
      "EmailPartReceivedV1",
      "DocumentFileUploadedV1",
      "DocumentTextRecordedV1",
      "EmailBookingCandidateExtractedV1",
      "EmailPartProcessedV1",
      "BookingExtractedFromDocumentTextV1",
      "EmailIngestGatheredV1",
    ]);
    expect(stored.events[9].payload).toMatchObject({
      id: "booking-1",
      documentTextRecordedId: "file-text-1",
    });
    expect(stored.events[10].payload).toMatchObject({
      originalMessageId: "mail-123",
      bookingExtractedIds: ["booking-1"],
      discardedCandidateIds: ["candidate-body"],
    });
  });
});
