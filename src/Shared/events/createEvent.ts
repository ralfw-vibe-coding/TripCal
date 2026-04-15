import type { Event } from "@ricofritzsche/eventstore";

export function createEvent(
  eventType: string,
  payload: Record<string, unknown>
): Event {
  return {
    eventType,
    payload
  };
}

