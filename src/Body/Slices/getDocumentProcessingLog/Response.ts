import type { DocumentProcessingStatus } from "../../../Data/DocumentProcessingStatus.js";

export type ProcessedDocumentLogEntry = {
  documentStoredId: string;
  originalFileName?: string;
  contentType: string;
  status: DocumentProcessingStatus;
  storedAt: string;
  analysisStartedAt?: string;
  analysisFinishedAt?: string;
  analysisFailedAt?: string;
  failureReason?: string;
  bookingRegisteredIds: string[];
};

export type GetDocumentProcessingLogResponse = {
  documents: ProcessedDocumentLogEntry[];
};

