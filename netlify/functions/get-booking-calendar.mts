import type { Config, Context } from "@netlify/functions";

import { handleGetBookingCalendar } from "../../src/Head/Portals/NetlifyFunctions/getBookingCalendar.js";

export default async (request: Request, context: Context) => {
  return handleGetBookingCalendar(request, context);
};

export const config: Config = {
  path: "/api/booking-calendar"
};

