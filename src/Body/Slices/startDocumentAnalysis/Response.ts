export type StartDocumentAnalysisResponse =
  | {
      success: true;
      status: "analysis_started" | "no_document_ready";
    }
  | {
      success: false;
      reason: string;
    };

