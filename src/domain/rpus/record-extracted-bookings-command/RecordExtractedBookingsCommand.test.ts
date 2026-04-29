import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { SubmitDocumentTextCommand } from "../submit-document-text-command/SubmitDocumentTextCommand";
import { RecordExtractedBookingsCommand } from "./RecordExtractedBookingsCommand";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { GetBookingCalendarQuery } from "../get-booking-calendar-query/GetBookingCalendarQuery";

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

describe("RecordExtractedBookingsCommand", () => {
  it("records one event for each extracted booking and the calendar query returns sorted bookings", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["text-1", "booking-2", "booking-1"]);

    const submitText = new SubmitDocumentTextCommand(eventStore, ids);
    const submitted = await submitText.process({
      source: "text",
      text: "Travel document",
      recordedAt: "2026-04-28T10:00:00.000Z",
    });

    expect(submitted.status).toBe("succeeded");
    if (submitted.status !== "succeeded") throw new Error("submit failed");

    const command = new RecordExtractedBookingsCommand(
      eventStore,
      ids,
      new TravelerResolver({ RW: ["Ralf"], AK: ["Ralfs Frau"] }),
    );
    const recorded = await command.process({
      documentTextRecordedId: submitted.documentTextRecordedId,
      extractedAt: "2026-04-28T10:01:00.000Z",
      bookings: [
        {
          title: "Later booking",
          type: "train",
          start: { value: "2026-11-04", precision: "date" },
          travelers: ["Ralf"],
          details: "Later",
        },
        {
          title: "Earlier booking",
          type: "flight",
          start: { value: "2026-11-03", precision: "date" },
          travelers: ["Ralf", "Ralfs Frau"],
          details: "Earlier",
        },
      ],
    });

    expect(recorded).toEqual({
      status: "succeeded",
      bookingExtractedIds: ["booking-2", "booking-1"],
    });

    const calendar = await new GetBookingCalendarQuery(
      eventStore,
      new TravelerResolver({ RW: ["Ralf"], AK: ["Ralfs Frau"] }),
    ).process({});

    expect(calendar.bookings.map((booking) => booking.title)).toEqual(["Earlier booking", "Later booking"]);
    expect(calendar.bookings[0].documentTextRecordedId).toBe("text-1");
    expect(calendar.bookings[0].travelers).toEqual(["RW", "AK"]);
  });
});
