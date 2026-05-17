import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import { CreateTripCommand } from "../create-trip-command/CreateTripCommand";
import { GetTripDailyAllowancesQuery } from "../get-trip-daily-allowances-query/GetTripDailyAllowancesQuery";
import { SetTripDailyAllowancesCommand } from "./SetTripDailyAllowancesCommand";

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-05-17T10:00:00.000Z");
  }
}

class FixedIds implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  newId(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
  }
}

describe("SetTripDailyAllowancesCommand", () => {
  it("stores date keyed daily allowance assignments for a trip", async () => {
    const eventStore = new MemoryEventStore();
    const ids = new FixedIds(["trip-1", "allowances-1"]);
    const clock = new FixedClock();
    const createTrip = new CreateTripCommand(eventStore, ids, clock, 100);
    const command = new SetTripDailyAllowancesCommand(eventStore, ids, clock);
    const query = new GetTripDailyAllowancesQuery(eventStore);

    await createTrip.process({
      shortCode: "bg26",
      owner: "AK",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
    });
    const response = await command.process({
      tripCreatedId: "trip-1",
      assignments: [
        {
          date: "2026-05-02",
          country: "Bulgaria",
          countryAbbr: "bg",
          dailyAllowanceEuro: 33,
          factor: 2,
        },
      ],
    });

    expect(response).toEqual({ status: "succeeded", tripDailyAllowancesSetId: "allowances-1" });
    await expect(query.process({})).resolves.toEqual({
      assignmentsByTripId: {
        "trip-1": [
          {
            date: "2026-05-02",
            country: "Bulgaria",
            countryAbbr: "BG",
            dailyAllowanceEuro: 33,
            factor: 2,
          },
        ],
      },
    });
  });
});
