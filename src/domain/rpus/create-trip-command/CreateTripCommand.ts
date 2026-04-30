import { createFilter } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import type { Clock } from "../../../providers/clock/Clock";
import type { IdGenerator } from "../../../providers/ids/IdGenerator";
import type { TripCreatedV1, TripCreatedV1Payload } from "../../events/events";
import { tripCreatedV1 } from "../../events/eventTypes";

export type CreateTripCommandRequest = {
  shortCode: string;
  title?: string;
  owner: string;
  startDate: string;
  endDate: string;
};

export type CreateTripCommandResponse =
  | {
      status: "succeeded";
      tripCreatedId: string;
      tripNumber: number;
    }
  | {
      status: "failed";
      reason: "missing_short_code" | "missing_owner" | "invalid_dates" | "duplicate_short_code";
    };

const tripColors = ["#16824b", "#2563a9", "#b32958", "#8a4f00", "#7c3f9d", "#087487", "#9b3a21", "#4f6f52"];

export class CreateTripCommand {
  constructor(
    private readonly eventStore: EventStore,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly initialTripNumber: number,
  ) {}

  async process(request: CreateTripCommandRequest): Promise<CreateTripCommandResponse> {
    const shortCode = request.shortCode.trim().toUpperCase();
    const owner = request.owner.trim().toUpperCase();
    const title = normalizeOptional(request.title);

    if (!shortCode) return { status: "failed", reason: "missing_short_code" };
    if (!owner) return { status: "failed", reason: "missing_owner" };
    if (!isDate(request.startDate) || !isDate(request.endDate) || request.startDate > request.endDate) {
      return { status: "failed", reason: "invalid_dates" };
    }

    const existingTrips = await this.loadTrips();
    if (existingTrips.some((trip) => trip.shortCode.toUpperCase() === shortCode)) {
      return { status: "failed", reason: "duplicate_short_code" };
    }

    const tripNumber = nextTripNumber(existingTrips, this.initialTripNumber);
    const event: TripCreatedV1 = {
      eventType: tripCreatedV1,
      payload: {
        id: this.idGenerator.newId(),
        tripNumber,
        shortCode,
        title,
        owner,
        startDate: request.startDate,
        endDate: request.endDate,
        color: tripColors[tripNumber % tripColors.length],
        createdAt: this.clock.now().toISOString(),
      },
    };

    await this.eventStore.append([event]);

    return { status: "succeeded", tripCreatedId: event.payload.id, tripNumber };
  }

  private async loadTrips(): Promise<TripCreatedV1Payload[]> {
    const result = await this.eventStore.query(createFilter([tripCreatedV1]));
    return result.events.map((event) => event.payload as TripCreatedV1Payload);
  }
}

function nextTripNumber(trips: TripCreatedV1Payload[], initialTripNumber: number): number {
  if (trips.length === 0) return initialTripNumber;
  return Math.max(...trips.map((trip) => trip.tripNumber)) + 1;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
