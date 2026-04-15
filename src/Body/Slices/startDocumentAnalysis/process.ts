import type { ProcessorDependencies } from "../../Processor/Dependencies.js";
import type { StartDocumentAnalysisRequest } from "./Request.js";
import type { StartDocumentAnalysisResponse } from "./Response.js";

export async function processStartDocumentAnalysis(
  dependencies: ProcessorDependencies,
  _request: StartDocumentAnalysisRequest
): Promise<StartDocumentAnalysisResponse> {
  await dependencies.analysisTrigger.triggerAnalyzeNextDocument();

  return {
    success: true,
    status: "analysis_started"
  };
}

