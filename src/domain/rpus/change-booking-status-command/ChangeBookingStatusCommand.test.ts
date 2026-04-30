import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { TravelerResolver } from "../../../providers/travelers/TravelerResolver";
import { GetBookingCalendarQuery } from "../get-booking-calendar-query/GetBookingCalendarQuery";
import { RecordExtractedBookingsCommand } from "../record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../submit-document-text-command/SubmitDocumentTextCommand";
import { ChangeBookingStatusCommand } from "./ChangeBookingStatusCommand";

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-04-30T10:00:00.000Z");
  }
}

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

describe("ChangeBookingStatusCommand", () => {
  it("records a status change and the calendar shows the latest status", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["text-1", "booking-1", "status-1"]);
    const travelerResolver = new TravelerResolver({});
    const submitted = await new SubmitDocumentTextCommand(eventStore, ids).process({
      source: "text",
      text: "Travel document",
      recordedAt: "2026-04-30T09:00:00.000Z",
    });
    if (submitted.status !== "succeeded") throw new Error("submit failed");

    await new RecordExtractedBookingsCommand(eventStore, ids, travelerResolver).process({
      documentTextRecordedId: submitted.documentTextRecordedId,
      extractedAt: "2026-04-30T09:01:00.000Z",
      bookings: [
        {
          title: "Flight",
          type: "flight",
          start: { value: "2026-06-12T10:00", precision: "datetime" },
          travelers: [],
          details: "Flight",
        },
      ],
    });

    const changed = await new ChangeBookingStatusCommand(eventStore, ids, new FixedClock()).process({
      bookingExtractedId: "booking-1",
      status: "reviewed",
    });

    expect(changed).toEqual({ status: "succeeded", bookingStatusChangedId: "status-1" });

    const calendar = await new GetBookingCalendarQuery(eventStore, travelerResolver).process({});
    expect(calendar.bookings[0].status).toBe("reviewed");
  });
});
