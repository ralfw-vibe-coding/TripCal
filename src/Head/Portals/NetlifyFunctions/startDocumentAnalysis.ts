import type { Context } from "@netlify/functions";

import { createPortalProcessor } from "./createPortalProcessor.js";
import { internalErrorResponse, jsonResponse } from "./http.js";

export async function handleStartDocumentAnalysis(
  _request: Request,
  _context: Context
): Promise<Response> {
  try {
    const processor = await createPortalProcessor();
    const response = await processor.startDocumentAnalysis({});
    return jsonResponse(response, { status: response.success ? 200 : 400 });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

