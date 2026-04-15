import type { Processor } from "./Processor.js";
import type { ProcessorDependencies } from "./Dependencies.js";
import { processAnalyzeNextDocument } from "../Slices/analyzeNextDocument/process.js";
import { processGetBookingCalendar } from "../Slices/getBookingCalendar/process.js";
import { processGetDocumentProcessingLog } from "../Slices/getDocumentProcessingLog/process.js";
import { processStartDocumentAnalysis } from "../Slices/startDocumentAnalysis/process.js";
import { processSubmitBookingDocuments } from "../Slices/submitBookingDocuments/process.js";

export function createProcessor(dependencies: ProcessorDependencies): Processor {
  return {
    submitBookingDocuments(request) {
      return processSubmitBookingDocuments(dependencies, request);
    },
    startDocumentAnalysis(request) {
      return processStartDocumentAnalysis(dependencies, request);
    },
    analyzeNextDocument(request) {
      return processAnalyzeNextDocument(dependencies, request);
    },
    getDocumentProcessingLog(request) {
      return processGetDocumentProcessingLog(dependencies, request);
    },
    getBookingCalendar(request) {
      return processGetBookingCalendar(dependencies, request);
    }
  };
}

