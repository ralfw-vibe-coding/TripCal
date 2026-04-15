import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { GetBookingCalendarRequest } from "./Request.js";
import type { GetBookingCalendarResponse } from "./Response.js";

export async function processGetBookingCalendar(
  _dependencies: ProcessorDependencies,
  _request: GetBookingCalendarRequest
): Promise<GetBookingCalendarResponse> {
  return {
    days: []
  };
}

