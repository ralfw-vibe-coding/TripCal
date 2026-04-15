import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { AnalyzeNextDocumentRequest } from "./Request.js";
import type { AnalyzeNextDocumentResponse } from "./Response.js";

export async function processAnalyzeNextDocument(
  _dependencies: ProcessorDependencies,
  _request: AnalyzeNextDocumentRequest
): Promise<AnalyzeNextDocumentResponse> {
  return {
    success: false,
    reason: "analyzeNextDocument is not implemented yet"
  };
}

