export type SubmitBookingDocumentsResponse =
  | {
      success: true;
      documentStoredIds: string[];
    }
  | {
      success: false;
      reason: string;
    };

