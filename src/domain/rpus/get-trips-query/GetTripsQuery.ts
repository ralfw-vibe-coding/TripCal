import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { TripCreatedV1Payload } from "../../events/events";
import { tripCreatedV1 } from "../../events/eventTypes";
import type { Trip } from "../../model";

export type GetTripsQueryRequest = Record<string, never>;

export type GetTripsQueryResponse = {
  trips: Trip[];
};

export class GetTripsQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(_request: GetTripsQueryRequest = {}): Promise<GetTripsQueryResponse> {
    const result = await this.eventStore.query(createFilter([tripCreatedV1]));
    const trips = result.events
      .map((event) => toTrip(event.payload as TripCreatedV1Payload))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.tripNumber - b.tripNumber);

    return { trips };
  }
}

function toTrip(payload: TripCreatedV1Payload): Trip {
  return {
    tripCreatedId: payload.id,
    tripNumber: payload.tripNumber,
    shortCode: payload.shortCode,
    title: payload.title,
    owner: payload.owner,
    startDate: payload.startDate,
    endDate: payload.endDate,
    color: payload.color,
  };
}
