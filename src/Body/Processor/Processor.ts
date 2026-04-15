import type { AnalyzeNextDocumentRequest } from "../Slices/analyzeNextDocument/Request.js";
import type { AnalyzeNextDocumentResponse } from "../Slices/analyzeNextDocument/Response.js";
import type { GetBookingCalendarRequest } from "../Slices/getBookingCalendar/Request.js";
import type { GetBookingCalendarResponse } from "../Slices/getBookingCalendar/Response.js";
import type { GetDocumentProcessingLogRequest } from "../Slices/getDocumentProcessingLog/Request.js";
import type { GetDocumentProcessingLogResponse } from "../Slices/getDocumentProcessingLog/Response.js";
import type { StartDocumentAnalysisRequest } from "../Slices/startDocumentAnalysis/Request.js";
import type { StartDocumentAnalysisResponse } from "../Slices/startDocumentAnalysis/Response.js";
import type { SubmitBookingDocumentsRequest } from "../Slices/submitBookingDocuments/Request.js";
import type { SubmitBookingDocumentsResponse } from "../Slices/submitBookingDocuments/Response.js";

export interface Processor {
  submitBookingDocuments(
    request: SubmitBookingDocumentsRequest
  ): Promise<SubmitBookingDocumentsResponse>;

  startDocumentAnalysis(
    request: StartDocumentAnalysisRequest
  ): Promise<StartDocumentAnalysisResponse>;

  analyzeNextDocument(
    request: AnalyzeNextDocumentRequest
  ): Promise<AnalyzeNextDocumentResponse>;

  getDocumentProcessingLog(
    request: GetDocumentProcessingLogRequest
  ): Promise<GetDocumentProcessingLogResponse>;

  getBookingCalendar(
    request: GetBookingCalendarRequest
  ): Promise<GetBookingCalendarResponse>;
}

