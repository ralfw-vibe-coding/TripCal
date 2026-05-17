import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TripDailyAllowancesSetV1 } from "../../events/events";
import { tripCreatedV1, tripDailyAllowancesSetV1 } from "../../events/eventTypes";
import type { TripDailyAllowanceAssignment } from "../../model";

export type SetTripDailyAllowancesCommandRequest = {
  tripCreatedId: string;
  assignments: TripDailyAllowanceAssignment[];
};

export type SetTripDailyAllowancesCommandResponse =
  | {
      status: "succeeded";
      tripDailyAllowancesSetId: string;
    }
  | {
      status: "failed";
      reason: "trip_not_found" | "invalid_assignment";
    };

export class SetTripDailyAllowancesCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: SetTripDailyAllowancesCommandRequest): Promise<SetTripDailyAllowancesCommandResponse> {
    const tripCreatedId = request.tripCreatedId.trim();
    const tripResult = await this.eventStore.query(createFilter([tripCreatedV1], [{ id: tripCreatedId }]));
    if (tripResult.events.length === 0) {
      return { status: "failed", reason: "trip_not_found" };
    }

    const normalizedAssignments = normalizeAssignments(request.assignments);
    if (!normalizedAssignments) {
      return { status: "failed", reason: "invalid_assignment" };
    }

    const event: TripDailyAllowancesSetV1 = {
      eventType: tripDailyAllowancesSetV1,
      payload: {
        id: this.idGenerator.newId(),
        tripCreatedId,
        assignments: normalizedAssignments,
        setAt: this.clock.now().toISOString(),
      },
    };

    await this.eventStore.append([event]);

    return { status: "succeeded", tripDailyAllowancesSetId: event.payload.id };
  }
}

function normalizeAssignments(assignments: TripDailyAllowanceAssignment[]): TripDailyAllowanceAssignment[] | undefined {
  const byDate = new Map<string, TripDailyAllowanceAssignment>();
  for (const assignment of assignments) {
    const date = assignment.date.trim();
    const country = assignment.country.trim();
    const countryAbbr = assignment.countryAbbr.trim().toUpperCase();
    const dailyAllowanceEuro = Number(assignment.dailyAllowanceEuro);
    const factor = assignment.factor === 1 ? 1 : assignment.factor === 2 ? 2 : undefined;
    if (!isDate(date) || !country || !countryAbbr || !Number.isFinite(dailyAllowanceEuro) || dailyAllowanceEuro < 0 || !factor) {
      return undefined;
    }
    byDate.set(date, {
      date,
      country,
      countryAbbr,
      dailyAllowanceEuro,
      factor,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
