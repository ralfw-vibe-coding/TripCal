import type { Context } from "@netlify/functions";

import { handleAnalyzeNextDocument } from "../../src/Head/Portals/NetlifyFunctions/analyzeNextDocument.js";

export default async (request: Request, context: Context) => {
  await handleAnalyzeNextDocument(request, context);
};

