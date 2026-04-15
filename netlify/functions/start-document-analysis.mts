import type { Config, Context } from "@netlify/functions";

import { handleStartDocumentAnalysis } from "../../src/Head/Portals/NetlifyFunctions/startDocumentAnalysis.js";

export default async (request: Request, context: Context) => {
  return handleStartDocumentAnalysis(request, context);
};

export const config: Config = {
  path: "/api/document-analysis/start"
};

