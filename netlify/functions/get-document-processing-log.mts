import type { Config, Context } from "@netlify/functions";

import { handleGetDocumentProcessingLog } from "../../src/Head/Portals/NetlifyFunctions/getDocumentProcessingLog.js";

export default async (request: Request, context: Context) => {
  return handleGetDocumentProcessingLog(request, context);
};

export const config: Config = {
  path: "/api/documents/log"
};

