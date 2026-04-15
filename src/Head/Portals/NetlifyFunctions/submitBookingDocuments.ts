import type { Context } from "@netlify/functions";

import type { SubmitBookingDocumentsRequest } from "../../../Body/Slices/submitBookingDocuments/Request.js";
import { createPortalProcessor } from "./createPortalProcessor.js";
import { internalErrorResponse, jsonResponse, readJson } from "./http.js";

export async function handleSubmitBookingDocuments(
  request: Request,
  _context: Context
): Promise<Response> {
  try {
    const processor = await createPortalProcessor();
    const body = await readJson<{
      documents: Array<{
        contentType: SubmitBookingDocumentsRequest["documents"][number]["contentType"];
        originalFileName?: string;
        storageSource: "upload" | "clipboard";
        contentBase64: string;
      }>;
    }>(request);

    const response = await processor.submitBookingDocuments({
      documents: body.documents.map((document) => ({
        contentType: document.contentType,
        originalFileName: document.originalFileName,
        storageSource: document.storageSource,
        content: Buffer.from(document.contentBase64, "base64")
      }))
    });

    return jsonResponse(response, { status: response.success ? 200 : 400 });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

