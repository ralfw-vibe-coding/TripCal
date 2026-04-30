import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { CreateTripCommand } from "./CreateTripCommand";

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

describe("CreateTripCommand", () => {
  it("creates trips with consecutive trip numbers starting at the configured initial number", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["trip-1", "trip-2"]);
    const command = new CreateTripCommand(eventStore, ids, new FixedClock(), 10);

    const first = await command.process({
      shortCode: "vn26",
      owner: "rw",
      startDate: "2026-04-07",
      endDate: "2026-05-04",
    });
    const second = await command.process({
      shortCode: "SOF26",
      owner: "AK",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
    });

    expect(first).toMatchObject({ status: "succeeded", tripCreatedId: "trip-1", tripNumber: 10 });
    expect(second).toMatchObject({ status: "succeeded", tripCreatedId: "trip-2", tripNumber: 11 });

    const stored = await eventStore.query();
    expect(stored.events.map((event) => event.payload.tripNumber)).toEqual([10, 11]);
    expect(stored.events[0].payload.shortCode).toBe("VN26");
    expect(stored.events[0].payload.owner).toBe("RW");
  });
});
