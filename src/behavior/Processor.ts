import type {
  AssignBookingToTrip,
  AssignBookingToTripRequest,
  AssignBookingToTripResponse,
} from "./slices/assign-booking-to-trip/AssignBookingToTrip";
import type { CreateTrip, CreateTripRequest, CreateTripResponse } from "./slices/create-trip/CreateTrip";
import type { CorrectBooking, CorrectBookingRequest, CorrectBookingResponse } from "./slices/correct-booking/CorrectBooking";
import type {
  ChangeBookingStatus,
  ChangeBookingStatusRequest,
  ChangeBookingStatusResponse,
} from "./slices/change-booking-status/ChangeBookingStatus";
import type { DeleteBooking, DeleteBookingRequest, DeleteBookingResponse } from "./slices/delete-booking/DeleteBooking";
import type { IngestEmail, IngestEmailRequest, IngestEmailResponse } from "./slices/ingest-email/IngestEmail";
import type {
  SubmitDocumentText,
  SubmitDocumentTextRequest,
  SubmitDocumentTextResponse,
} from "./slices/submit-document-text/SubmitDocumentText";
import type {
  SubmitDocumentImage,
  SubmitDocumentImageRequest,
  SubmitDocumentImageResponse,
} from "./slices/submit-document-image/SubmitDocumentImage";
import type {
  SubmitDocumentFiles,
  SubmitDocumentFilesRequest,
  SubmitDocumentFilesResponse,
} from "./slices/submit-document-files/SubmitDocumentFiles";
import type {
  ViewBookingCalendar,
  ViewBookingCalendarRequest,
  ViewBookingCalendarResponse,
} from "./slices/view-booking-calendar/ViewBookingCalendar";
import type { ViewTrips, ViewTripsRequest, ViewTripsResponse } from "./slices/view-trips/ViewTrips";

export class Processor {
  constructor(
    private readonly submitDocumentTextSlice: SubmitDocumentText,
    private readonly submitDocumentImageSlice: SubmitDocumentImage,
    private readonly submitDocumentFilesSlice: SubmitDocumentFiles,
    private readonly ingestEmailSlice: IngestEmail,
    private readonly createTripSlice: CreateTrip,
    private readonly assignBookingToTripSlice: AssignBookingToTrip,
    private readonly correctBookingSlice: CorrectBooking,
    private readonly changeBookingStatusSlice: ChangeBookingStatus,
    private readonly deleteBookingSlice: DeleteBooking,
    private readonly viewTripsSlice: ViewTrips,
    private readonly viewBookingCalendarSlice: ViewBookingCalendar,
  ) {}

  submitDocumentText(request: SubmitDocumentTextRequest): Promise<SubmitDocumentTextResponse> {
    return this.submitDocumentTextSlice.process(request);
  }

  submitDocumentImage(request: SubmitDocumentImageRequest): Promise<SubmitDocumentImageResponse> {
    return this.submitDocumentImageSlice.process(request);
  }

  submitDocumentFiles(request: SubmitDocumentFilesRequest): Promise<SubmitDocumentFilesResponse> {
    return this.submitDocumentFilesSlice.process(request);
  }

  ingestEmail(request: IngestEmailRequest): Promise<IngestEmailResponse> {
    return this.ingestEmailSlice.process(request);
  }

  createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
    return this.createTripSlice.process(request);
  }

  assignBookingToTrip(request: AssignBookingToTripRequest): Promise<AssignBookingToTripResponse> {
    return this.assignBookingToTripSlice.process(request);
  }

  correctBooking(request: CorrectBookingRequest): Promise<CorrectBookingResponse> {
    return this.correctBookingSlice.process(request);
  }

  changeBookingStatus(request: ChangeBookingStatusRequest): Promise<ChangeBookingStatusResponse> {
    return this.changeBookingStatusSlice.process(request);
  }

  deleteBooking(request: DeleteBookingRequest): Promise<DeleteBookingResponse> {
    return this.deleteBookingSlice.process(request);
  }

  viewTrips(request: ViewTripsRequest = {}): Promise<ViewTripsResponse> {
    return this.viewTripsSlice.process(request);
  }

  viewBookingCalendar(request: ViewBookingCalendarRequest = {}): Promise<ViewBookingCalendarResponse> {
    return this.viewBookingCalendarSlice.process(request);
  }
}
