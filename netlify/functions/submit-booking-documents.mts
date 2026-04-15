import type { Config, Context } from "@netlify/functions";

import { handleSubmitBookingDocuments } from "../../src/Head/Portals/NetlifyFunctions/submitBookingDocuments.js";

export default async (request: Request, context: Context) => {
  return handleSubmitBookingDocuments(request, context);
};

export const config: Config = {
  path: "/api/documents/submit"
};

