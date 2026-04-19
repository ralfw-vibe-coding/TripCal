import { MemoryEventStore } from "@ricofritzsche/eventstore";
import { describe, expect, it } from "vitest";

import { createDependencies } from "../../../Head/Application/createDependencies.js";
import { createEvent } from "../../../Shared/events/createEvent.js";
import { eventTypes } from "../../../Shared/events/eventTypes.js";
import { createProcessor } from "../../Processor/createProcessor.js";

describe("getBookingCalendar", () => {
  it("groups registered bookings by the date of time.start", async () => {
    const eventStore = new MemoryEventStore();
    await eventStore.append([
      createEvent(eventTypes.bookingRegistered, {
        bookingRegisteredId: "booking-2",
        type: "flight",
        title: "Flight Sofia-Hamburg",
        details: "LH123",
        time: {
          start: "2026-04-21T09:00:00.000Z",
          end: "2026-04-21T11:30:00.000Z"
        },
        location: {
          from: "Sofia",
          to: "Hamburg"
        },
        scopes: {
          documentStoredId: "document-2",
          analysisStartedId: "analysis-2"
        }
      }),
      createEvent(eventTypes.bookingRegistered, {
        bookingRegisteredId: "booking-1",
        type: "accommodation",
        title: "Hotel Royal Palace",
        details: "4 nights",
        time: {
          start: "2026-04-20T15:00:00.000Z",
          end: "2026-04-24T11:00:00.000Z"
        },
        location: {
          from: "Hue"
        },
        scopes: {
          documentStoredId: "document-1",
          analysisStartedId: "analysis-1"
        }
      }),
      createEvent(eventTypes.bookingRegistered, {
        bookingRegisteredId: "booking-3",
        type: "activity",
        title: "Cinema",
        details: "Ticket 7B",
        time: {
          start: "2026-04-21T18:00:00.000Z",
          end: "2026-04-21T18:00:00.000Z"
        },
        location: {
          from: "Hamburg"
        },
        scopes: {
          documentStoredId: "document-3",
          analysisStartedId: "analysis-3"
        }
      })
    ]);

    const processor = createProcessor(
      createDependencies({
        eventStore
      })
    );

    const response = await processor.getBookingCalendar({});

    expect(response).toEqual({
      days: [
        {
          date: "2026-04-20",
          bookings: [
            {
              bookingRegisteredId: "booking-1",
              type: "accommodation",
              title: "Hotel Royal Palace",
              details: "4 nights",
              time: {
                start: "2026-04-20T15:00:00.000Z",
                end: "2026-04-24T11:00:00.000Z"
              },
              location: {
                from: "Hue",
                to: undefined
              },
              documentStoredId: "document-1"
            }
          ]
        },
        {
          date: "2026-04-21",
          bookings: [
            {
              bookingRegisteredId: "booking-2",
              type: "flight",
              title: "Flight Sofia-Hamburg",
              details: "LH123",
              time: {
                start: "2026-04-21T09:00:00.000Z",
                end: "2026-04-21T11:30:00.000Z"
              },
              location: {
                from: "Sofia",
                to: "Hamburg"
              },
              documentStoredId: "document-2"
            },
            {
              bookingRegisteredId: "booking-3",
              type: "activity",
              title: "Cinema",
              details: "Ticket 7B",
              time: {
                start: "2026-04-21T18:00:00.000Z",
                end: "2026-04-21T18:00:00.000Z"
              },
              location: {
                from: "Hamburg",
                to: undefined
              },
              documentStoredId: "document-3"
            }
          ]
        }
      ]
    });
  });
});
