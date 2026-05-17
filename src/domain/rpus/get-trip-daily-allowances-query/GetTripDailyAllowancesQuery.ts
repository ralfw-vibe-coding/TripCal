import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { TripDailyAllowancesSetV1Payload } from "../../events/events";
import { tripDailyAllowancesSetV1 } from "../../events/eventTypes";
import type { TripDailyAllowanceAssignment } from "../../model";

export type GetTripDailyAllowancesQueryRequest = Record<string, never>;

export type GetTripDailyAllowancesQueryResponse = {
  assignmentsByTripId: Record<string, TripDailyAllowanceAssignment[]>;
};

export class GetTripDailyAllowancesQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(_request: GetTripDailyAllowancesQueryRequest = {}): Promise<GetTripDailyAllowancesQueryResponse> {
    const result = await this.eventStore.query(createFilter([tripDailyAllowancesSetV1]));
    const assignmentsByTripId = new Map<string, TripDailyAllowanceAssignment[]>();
    for (const event of result.events) {
      if (event.eventType !== tripDailyAllowancesSetV1) continue;
      const payload = event.payload as TripDailyAllowancesSetV1Payload;
      assignmentsByTripId.set(payload.tripCreatedId, [...payload.assignments].sort((a, b) => a.date.localeCompare(b.date)));
    }

    return {
      assignmentsByTripId: Object.fromEntries(assignmentsByTripId.entries()),
    };
  }
}
