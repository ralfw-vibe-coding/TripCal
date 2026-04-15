export type AnalyzeNextDocumentResponse =
  | {
      success: true;
      status: "document_analyzed";
      documentStoredId: string;
      analysisStartedId: string;
    }
  | {
      success: true;
      status: "no_document_ready";
    }
  | {
      success: false;
      reason: string;
    };

