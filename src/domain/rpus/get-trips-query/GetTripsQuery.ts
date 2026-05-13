import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { TripCorrectedV1Payload, TripCreatedV1Payload } from "../../events/events";
import { tripCorrectedV1, tripCreatedV1 } from "../../events/eventTypes";
import type { Trip, TripCorrectionPatch } from "../../model";

export type GetTripsQueryRequest = Record<string, never>;

export type GetTripsQueryResponse = {
  trips: Trip[];
};

export class GetTripsQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(_request: GetTripsQueryRequest = {}): Promise<GetTripsQueryResponse> {
    const result = await this.eventStore.query(createFilter([tripCreatedV1, tripCorrectedV1]));
    const trips = projectTrips(
      result.events
        .filter((event) => event.eventType === tripCreatedV1)
        .map((event) => event.payload as TripCreatedV1Payload),
      result.events
        .filter((event) => event.eventType === tripCorrectedV1)
        .map((event) => event.payload as TripCorrectedV1Payload),
    )
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.tripNumber - b.tripNumber);

    return { trips };
  }
}

function projectTrips(created: TripCreatedV1Payload[], corrected: TripCorrectedV1Payload[]): Trip[] {
  const trips = new Map<string, Trip>();
  for (const payload of created) {
    trips.set(payload.id, {
      tripCreatedId: payload.id,
      tripNumber: payload.tripNumber,
      shortCode: payload.shortCode,
      title: payload.title,
      owner: payload.owner,
      startDate: payload.startDate,
      endDate: payload.endDate,
      color: payload.color,
    });
  }
  for (const event of corrected) {
    const trip = trips.get(event.tripCreatedId);
    if (!trip) continue;
    applyPatch(trip, event.patch);
  }
  return [...trips.values()];
}

function applyPatch(trip: Trip, patch: TripCorrectionPatch): void {
  if (patch.shortCode !== undefined) trip.shortCode = patch.shortCode;
  if (patch.title !== undefined) trip.title = patch.title ?? undefined;
  if (patch.owner !== undefined) trip.owner = patch.owner;
  if (patch.startDate !== undefined) trip.startDate = patch.startDate;
  if (patch.endDate !== undefined) trip.endDate = patch.endDate;
}
