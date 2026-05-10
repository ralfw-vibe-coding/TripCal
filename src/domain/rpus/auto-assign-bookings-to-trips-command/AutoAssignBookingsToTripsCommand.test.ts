import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import { AutoAssignBookingsToTripsCommand } from "./AutoAssignBookingsToTripsCommand";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

describe("AutoAssignBookingsToTripsCommand", () => {
  it("assigns a booking to the only trip whose date range contains the booking start date", async () => {
    const eventStore = new MemoryEventStore();
    await eventStore.append([
      {
        eventType: "TripCreatedV1",
        payload: {
          id: "trip-1",
          tripNumber: 10,
          shortCode: "VN26",
          owner: "RW",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          color: "#1f7a4d",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      },
      {
        eventType: "BookingExtractedFromDocumentTextV1",
        payload: {
          id: "booking-1",
          documentTextRecordedId: "text-1",
          title: "Flight to Hanoi",
          type: "flight",
          status: "inbox",
          start: { value: "2026-04-12T09:00:00", precision: "datetime" },
          travelers: ["RW"],
          details: "Flight to Hanoi",
          extractedAt: "2026-03-10T10:00:00.000Z",
        },
      },
    ]);

    const response = await new AutoAssignBookingsToTripsCommand(eventStore, new FixedIds(["assignment-1"])).process({
      bookingExtractedIds: ["booking-1"],
      assignedAt: "2026-03-10T10:05:00.000Z",
    });

    expect(response).toEqual({
      status: "succeeded",
      bookingAssignedToTripIds: ["assignment-1"],
      skipped: [],
    });

    const stored = await eventStore.query();
    expect(stored.events.at(-1)?.eventType).toBe("BookingAssignedToTripV1");
    expect(stored.events.at(-1)?.payload).toMatchObject({
      id: "assignment-1",
      bookingExtractedId: "booking-1",
      tripCreatedId: "trip-1",
    });
  });

  it("does not assign when multiple trips match", async () => {
    const eventStore = new MemoryEventStore();
    await eventStore.append([
      {
        eventType: "TripCreatedV1",
        payload: {
          id: "trip-1",
          tripNumber: 10,
          shortCode: "A",
          owner: "RW",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          color: "#1f7a4d",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      },
      {
        eventType: "TripCreatedV1",
        payload: {
          id: "trip-2",
          tripNumber: 11,
          shortCode: "B",
          owner: "AK",
          startDate: "2026-04-10",
          endDate: "2026-04-20",
          color: "#2f6dcc",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      },
      {
        eventType: "BookingExtractedFromDocumentTextV1",
        payload: {
          id: "booking-1",
          documentTextRecordedId: "text-1",
          title: "Train",
          type: "train",
          status: "inbox",
          start: { value: "2026-04-12", precision: "date" },
          travelers: ["RW"],
          details: "Train",
          extractedAt: "2026-03-10T10:00:00.000Z",
        },
      },
    ]);

    const response = await new AutoAssignBookingsToTripsCommand(eventStore, new FixedIds(["assignment-1"])).process({
      bookingExtractedIds: ["booking-1"],
      assignedAt: "2026-03-10T10:05:00.000Z",
    });

    expect(response).toEqual({
      status: "succeeded",
      bookingAssignedToTripIds: [],
      skipped: [{ bookingExtractedId: "booking-1", reason: "multiple_matching_trips" }],
    });
  });
});
