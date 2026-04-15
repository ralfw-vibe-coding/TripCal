export type SubmittedDocument = {
  contentType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "text/plain"
    | "image/png"
    | "image/jpeg";
  originalFileName?: string;
  storageSource: "upload" | "clipboard";
  content: Uint8Array;
};

export type SubmitBookingDocumentsRequest = {
  documents: SubmittedDocument[];
};

