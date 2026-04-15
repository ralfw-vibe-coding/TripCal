import type { EventFilter } from "@ricofritzsche/eventstore";

export function singleScopeFilter(
  eventTypes: string[],
  scopeFieldName: string,
  scopeId: string
): EventFilter {
  return {
    eventTypes,
    payloadPredicates: [
      {
        scopes: {
          [scopeFieldName]: scopeId
        }
      }
    ]
  };
}

