import { createFilter } from "@ricofritzsche/eventstore";
import type { EventRecord, EventStore } from "@ricofritzsche/eventstore";
import type { BookingExtractedFromDocumentTextV1Payload } from "../../events/events";
import { bookingExtractedFromDocumentTextV1 } from "../../events/eventTypes";
import type { CalendarBooking } from "../../model";

export type GetBookingCalendarQueryRequest = Record<string, never>;

export type GetBookingCalendarQueryResponse = {
  bookings: CalendarBooking[];
};

export class GetBookingCalendarQuery {
  constructor(private readonly eventStore: EventStore) {}

  async process(_request: GetBookingCalendarQueryRequest = {}): Promise<GetBookingCalendarQueryResponse> {
    const result = await this.eventStore.query(createFilter([bookingExtractedFromDocumentTextV1]));
    const bookings = result.events
      .filter((event) => event.eventType === bookingExtractedFromDocumentTextV1)
      .map(toCalendarBooking)
      .sort(compareCalendarBookings);

    return { bookings };
  }
}

function toCalendarBooking(event: EventRecord): CalendarBooking {
  const payload = event.payload as BookingExtractedFromDocumentTextV1Payload;

  return {
    bookingExtractedId: payload.id,
    documentTextRecordedId: payload.documentTextRecordedId,
    title: payload.title,
    type: payload.type,
    status: payload.status,
    start: payload.start,
    end: payload.end,
    from: payload.from,
    to: payload.to,
    travelers: payload.travelers,
    details: payload.details,
  };
}

function compareCalendarBookings(a: CalendarBooking, b: CalendarBooking): number {
  return startTime(a) - startTime(b) || a.title.localeCompare(b.title);
}

function startTime(booking: CalendarBooking): number {
  const value = booking.start.value;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
