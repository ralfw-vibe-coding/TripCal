import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { bookingExtractedFromDocumentTextV1, tripCreatedV1 } from "../../events/eventTypes";
import { AssignBookingToTripCommand } from "./AssignBookingToTripCommand";

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-04-30T10:00:00.000Z");
  }
}

class FixedIds implements IdGenerator {
  newId(): string {
    return "assignment-1";
  }
}

describe("AssignBookingToTripCommand", () => {
  it("assigns an existing booking to an existing trip", async () => {
    const eventStore = new MemoryEventStore();
    await eventStore.append([
      {
        eventType: bookingExtractedFromDocumentTextV1,
        payload: {
          id: "booking-1",
          documentTextRecordedId: "text-1",
          title: "Flight",
          type: "flight",
          status: "needs_review",
          start: { value: "2026-04-07", precision: "date" },
          travelers: [],
          details: "Flight",
          extractedAt: "2026-04-30T09:00:00.000Z",
        },
      },
      {
        eventType: tripCreatedV1,
        payload: {
          id: "trip-1",
          tripNumber: 10,
          shortCode: "VN26",
          owner: "RW",
          startDate: "2026-04-07",
          endDate: "2026-05-04",
          color: "#16824b",
          createdAt: "2026-04-30T08:00:00.000Z",
        },
      },
    ]);

    const command = new AssignBookingToTripCommand(eventStore, new FixedIds(), new FixedClock());
    const response = await command.process({ bookingExtractedId: "booking-1", tripCreatedId: "trip-1" });

    expect(response).toEqual({ status: "succeeded", bookingAssignedToTripId: "assignment-1" });

    const stored = await eventStore.query();
    expect(stored.events.at(-1)?.eventType).toBe("BookingAssignedToTripV1");
    expect(stored.events.at(-1)?.payload).toMatchObject({
      bookingExtractedId: "booking-1",
      tripCreatedId: "trip-1",
    });
  });
});
