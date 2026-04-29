import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { SubmitDocumentImage } from "./SubmitDocumentImage";

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
    return { text: "Flight LH123 from FRA to BER on 2026-06-10 for Ralf and Ralfs Frau." };
  },
};

const bookingExtractionProvider: BookingExtractionProvider = {
  async extractBookingsFromText() {
    return {
      bookings: [
        {
          title: "Flight LH123",
          type: "flight",
          start: { value: "2026-06-10", precision: "date" },
          from: { name: "FRA" },
          to: { name: "BER" },
          travelers: ["Ralf", "Ralfs Frau"],
          details: "Flight LH123",
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

describe("SubmitDocumentImage", () => {
  it("extracts text from an image and records bookings from that text", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["text-1", "booking-1"]);
    const sharedFlow = new RecordDocumentTextAndExtractBookings(
      new FixedClock(),
      activityLogProvider,
      new SubmitDocumentTextCommand(eventStore, ids),
      bookingExtractionProvider,
      new RecordExtractedBookingsCommand(eventStore, ids, new TravelerResolver({ RW: ["Ralf"], AK: ["Ralfs Frau"] })),
    );
    const slice = new SubmitDocumentImage(textExtractionProvider, sharedFlow);

    const response = await slice.process({
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      mimeType: "image/png",
    });

    expect(response).toEqual({
      status: "accepted",
      documentTextRecordedId: "text-1",
      bookingExtractedIds: ["booking-1"],
      warnings: undefined,
    });

    const stored = await eventStore.query();
    expect(stored.events[0].payload.source).toBe("image");
  });
});
