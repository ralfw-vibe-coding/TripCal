import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TripCorrectedV1, TripCorrectedV1Payload, TripCreatedV1Payload } from "../../events/events";
import { tripCorrectedV1, tripCreatedV1 } from "../../events/eventTypes";
import type { Trip, TripCorrectionPatch } from "../../model";

export type CorrectTripCommandRequest = {
  tripCreatedId: string;
  shortCode: string;
  title?: string;
  owner: string;
  startDate: string;
  endDate: string;
};

export type CorrectTripCommandResponse =
  | {
      status: "succeeded";
      tripCorrectedId?: string;
    }
  | {
      status: "failed";
      reason: "trip_not_found" | "missing_short_code" | "missing_owner" | "invalid_dates" | "duplicate_short_code";
    };

export class CorrectTripCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async process(request: CorrectTripCommandRequest): Promise<CorrectTripCommandResponse> {
    const shortCode = request.shortCode.trim().toUpperCase();
    const owner = request.owner.trim().toUpperCase();
    const title = normalizeOptional(request.title);

    if (!shortCode) return { status: "failed", reason: "missing_short_code" };
    if (!owner) return { status: "failed", reason: "missing_owner" };
    if (!isDate(request.startDate) || !isDate(request.endDate) || request.startDate > request.endDate) {
      return { status: "failed", reason: "invalid_dates" };
    }

    const trips = await this.loadTrips();
    const current = trips.find((trip) => trip.tripCreatedId === request.tripCreatedId);
    if (!current) return { status: "failed", reason: "trip_not_found" };

    if (trips.some((trip) => trip.tripCreatedId !== request.tripCreatedId && trip.shortCode.toUpperCase() === shortCode)) {
      return { status: "failed", reason: "duplicate_short_code" };
    }

    const patch: TripCorrectionPatch = {};
    if (current.shortCode !== shortCode) patch.shortCode = shortCode;
    if ((current.title ?? undefined) !== title) patch.title = title ?? null;
    if (current.owner !== owner) patch.owner = owner;
    if (current.startDate !== request.startDate) patch.startDate = request.startDate;
    if (current.endDate !== request.endDate) patch.endDate = request.endDate;

    if (Object.keys(patch).length === 0) {
      return { status: "succeeded" };
    }

    const event: TripCorrectedV1 = {
      eventType: tripCorrectedV1,
      payload: {
        id: this.idGenerator.newId(),
        tripCreatedId: request.tripCreatedId,
        correctedAt: this.clock.now().toISOString(),
        patch,
      },
    };

    await this.eventStore.append([event]);

    return { status: "succeeded", tripCorrectedId: event.payload.id };
  }

  private async loadTrips(): Promise<Trip[]> {
    const result = await this.eventStore.query(createFilter([tripCreatedV1, tripCorrectedV1]));
    return projectTrips(
      result.events
        .filter((event) => event.eventType === tripCreatedV1)
        .map((event) => event.payload as TripCreatedV1Payload),
      result.events
        .filter((event) => event.eventType === tripCorrectedV1)
        .map((event) => event.payload as TripCorrectedV1Payload),
    );
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

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
