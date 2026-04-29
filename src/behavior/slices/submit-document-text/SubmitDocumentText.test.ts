import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { SubmitDocumentText } from "./SubmitDocumentText";

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

const extractionProvider: BookingExtractionProvider = {
  async extractBookingsFromText() {
    return {
      bookings: [
        {
          title: "Hotel Kyoto",
          type: "accommodation",
          start: { value: "2026-10-03", precision: "date" },
          end: { value: "2026-10-05", precision: "date" },
          travelers: ["Ralf", "Ralfs Frau"],
          details: "Booking number: H123",
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

describe("SubmitDocumentText", () => {
  it("records document text and extracted bookings", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["text-1", "booking-1"]);
    const slice = new SubmitDocumentText(
      new RecordDocumentTextAndExtractBookings(
        new FixedClock(),
        activityLogProvider,
        new SubmitDocumentTextCommand(eventStore, ids),
        extractionProvider,
        new RecordExtractedBookingsCommand(eventStore, ids, new TravelerResolver({ RW: ["Ralf"], AK: ["Ralfs Frau"] })),
      ),
    );

    const response = await slice.process({ text: "A sufficiently long text" });

    expect(response).toEqual({
      status: "accepted",
      documentTextRecordedId: "text-1",
      bookingExtractedIds: ["booking-1"],
      warnings: undefined,
    });

    const stored = await eventStore.query();
    expect(stored.events.map((event) => event.eventType)).toEqual([
      "DocumentTextRecordedV1",
      "BookingExtractedFromDocumentTextV1",
    ]);
    expect(stored.events[0].payload.source).toBe("text");
    expect(stored.events[1].payload.travelers).toEqual(["RW", "AK"]);
  });
});
