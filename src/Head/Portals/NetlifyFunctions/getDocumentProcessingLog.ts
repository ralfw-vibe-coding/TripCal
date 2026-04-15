import type { Context } from "@netlify/functions";

import { createPortalProcessor } from "./createPortalProcessor.js";
import { internalErrorResponse, jsonResponse } from "./http.js";

export async function handleGetDocumentProcessingLog(
  _request: Request,
  _context: Context
): Promise<Response> {
  try {
    const processor = await createPortalProcessor();
    const response = await processor.getDocumentProcessingLog({});
    return jsonResponse(response);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

