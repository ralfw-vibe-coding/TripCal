import type {
  RecordDocumentTextAndExtractBookings,
  RecordDocumentTextAndExtractBookingsResponse,
} from "../../flows/RecordDocumentTextAndExtractBookings";

export type SubmitDocumentTextRequest = {
  text: string;
};

export type SubmitDocumentTextResponse = RecordDocumentTextAndExtractBookingsResponse;

export class SubmitDocumentText {
  constructor(private readonly recordDocumentTextAndExtractBookings: RecordDocumentTextAndExtractBookings) {}

  async process(request: SubmitDocumentTextRequest): Promise<SubmitDocumentTextResponse> {
    return this.recordDocumentTextAndExtractBookings.process({
      source: "text",
      documentName: "Manueller Text",
      text: request.text,
    });
  }
}
