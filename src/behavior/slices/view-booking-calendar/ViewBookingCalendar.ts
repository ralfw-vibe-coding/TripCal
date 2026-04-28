import type {
  GetBookingCalendarQuery,
  GetBookingCalendarQueryResponse,
} from "../../../domain/rpus/get-booking-calendar-query/GetBookingCalendarQuery";

export type ViewBookingCalendarRequest = Record<string, never>;

export type ViewBookingCalendarResponse = GetBookingCalendarQueryResponse;

export class ViewBookingCalendar {
  constructor(private readonly getBookingCalendarQuery: GetBookingCalendarQuery) {}

  async process(_request: ViewBookingCalendarRequest = {}): Promise<ViewBookingCalendarResponse> {
    return this.getBookingCalendarQuery.process({});
  }
}

