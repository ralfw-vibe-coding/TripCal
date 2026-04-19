import { createFilter } from "@ricofritzsche/eventstore";

import type { Booking } from "../../../Data/Booking.js";
import { eventTypes } from "../../../Shared/events/eventTypes.js";
import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { GetBookingCalendarRequest } from "./Request.js";
import type { GetBookingCalendarResponse } from "./Response.js";

export async function processGetBookingCalendar(
  dependencies: ProcessorDependencies,
  _request: GetBookingCalendarRequest
): Promise<GetBookingCalendarResponse> {
  const queryResult = await dependencies.eventStore.query(
    createFilter([eventTypes.bookingRegistered])
  );

  const bookings = queryResult.events
    .map((event) => toBooking(event.payload))
    .sort((left, right) => left.time.start.localeCompare(right.time.start));

  const days = new Map<string, Booking[]>();

  for (const booking of bookings) {
    const date = booking.time.start.slice(0, 10);
    const existingBookings = days.get(date);

    if (existingBookings) {
      existingBookings.push(booking);
      continue;
    }

    days.set(date, [booking]);
  }

  return {
    days: [...days.entries()].map(([date, groupedBookings]) => ({
      date,
      bookings: groupedBookings
    }))
  };
}

function toBooking(payload: Record<string, unknown>): Booking {
  const time = requiredObject(payload.time);
  const location = optionalObject(payload.location);
  const scopes = requiredObject(payload.scopes);

  return {
    bookingRegisteredId: requiredString(payload.bookingRegisteredId),
    type: requiredBookingType(payload.type),
    title: requiredString(payload.title),
    details: requiredString(payload.details),
    time: {
      start: requiredString(time.start),
      end: requiredString(time.end)
    },
    location: {
      from: optionalString(location?.from),
      to: optionalString(location?.to)
    },
    documentStoredId: requiredString(scopes.documentStoredId)
  };
}

function requiredObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("expected object payload value");
  }

  return value as Record<string, unknown>;
}

function optionalObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredObject(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value === "") {
    throw new Error("expected non-empty string payload value");
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value);
}

function requiredBookingType(value: unknown): Booking["type"] {
  const bookingType = requiredString(value);

  switch (bookingType) {
    case "accommodation":
    case "flight":
    case "train":
    case "bus":
    case "rentalCar":
    case "ship":
    case "activity":
    case "other":
      return bookingType;
    default:
      throw new Error(`unsupported booking type: ${bookingType}`);
  }
}
