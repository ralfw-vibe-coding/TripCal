import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { GetDocumentProcessingLogRequest } from "./Request.js";
import type { GetDocumentProcessingLogResponse } from "./Response.js";

export async function processGetDocumentProcessingLog(
  _dependencies: ProcessorDependencies,
  _request: GetDocumentProcessingLogRequest
): Promise<GetDocumentProcessingLogResponse> {
  return {
    documents: []
  };
}

