import type {
  SubmitDocumentText,
  SubmitDocumentTextRequest,
  SubmitDocumentTextResponse,
} from "./slices/submit-document-text/SubmitDocumentText";
import type {
  ViewBookingCalendar,
  ViewBookingCalendarRequest,
  ViewBookingCalendarResponse,
} from "./slices/view-booking-calendar/ViewBookingCalendar";

export class Processor {
  constructor(
    private readonly submitDocumentTextSlice: SubmitDocumentText,
    private readonly viewBookingCalendarSlice: ViewBookingCalendar,
  ) {}

  submitDocumentText(request: SubmitDocumentTextRequest): Promise<SubmitDocumentTextResponse> {
    return this.submitDocumentTextSlice.process(request);
  }

  viewBookingCalendar(request: ViewBookingCalendarRequest = {}): Promise<ViewBookingCalendarResponse> {
    return this.viewBookingCalendarSlice.process(request);
  }
}

