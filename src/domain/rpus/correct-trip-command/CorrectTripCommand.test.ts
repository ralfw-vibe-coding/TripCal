import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { CreateTripCommand } from "../create-trip-command/CreateTripCommand";
import { GetTripsQuery } from "../get-trips-query/GetTripsQuery";
import { CorrectTripCommand } from "./CorrectTripCommand";

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-05-13T10:00:00.000Z");
  }
}

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

describe("CorrectTripCommand", () => {
  it("records a correction event and trip queries apply it without changing trip number or color", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["trip-1", "trip-2", "trip-correction-1"]);
    const clock = new FixedClock();
    const createTrip = new CreateTripCommand(eventStore, ids, clock, 100);
    const correctTrip = new CorrectTripCommand(eventStore, ids, clock);

    await createTrip.process({
      shortCode: "VN26",
      title: "Vietnam 2026",
      owner: "RW",
      startDate: "2026-04-07",
      endDate: "2026-05-04",
    });
    await createTrip.process({
      shortCode: "JB",
      title: "Juni Business",
      owner: "AK",
      startDate: "2026-06-01",
      endDate: "2026-06-12",
    });

    await expect(
      correctTrip.process({
        tripCreatedId: "trip-1",
        shortCode: "JB",
        title: "Vietnam korrigiert",
        owner: "AK",
        startDate: "2026-04-08",
        endDate: "2026-05-05",
      }),
    ).resolves.toEqual({ status: "failed", reason: "duplicate_short_code" });

    await expect(
      correctTrip.process({
        tripCreatedId: "trip-1",
        shortCode: "VN27",
        title: "Vietnam korrigiert",
        owner: "AK",
        startDate: "2026-04-08",
        endDate: "2026-05-05",
      }),
    ).resolves.toEqual({ status: "succeeded", tripCorrectedId: "trip-correction-1" });

    const trips = await new GetTripsQuery(eventStore).process();
    expect(trips.trips.find((trip) => trip.tripCreatedId === "trip-1")).toMatchObject({
      tripCreatedId: "trip-1",
      tripNumber: 100,
      shortCode: "VN27",
      title: "Vietnam korrigiert",
      owner: "AK",
      startDate: "2026-04-08",
      endDate: "2026-05-05",
      color: "#7c3f9d",
    });
  });
});
