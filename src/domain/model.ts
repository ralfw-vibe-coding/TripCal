export type BookingType =
  | "flight"
  | "accommodation"
  | "train"
  | "bus"
  | "ferry"
  | "car"
  | "event"
  | "restaurant"
  | "activity"
  | "other";

export type BookingStatus = "needs_review" | "planned" | "cancelled";

export type BookingDateTime = {
  value: string;
  precision: "date" | "datetime";
  timezone?: string;
};

export type BookingPlace = {
  name: string;
  city?: string;
  country?: string;
};

export type ExtractedBooking = {
  title: string;
  type: BookingType;
  start: BookingDateTime;
  end?: BookingDateTime;
  from?: BookingPlace;
  to?: BookingPlace;
  travelers: string[];
  details: string;
};

export type CalendarBooking = {
  bookingExtractedId: string;
  documentTextRecordedId: string;
  title: string;
  type: BookingType;
  status: BookingStatus;
  start: BookingDateTime;
  end?: BookingDateTime;
  from?: BookingPlace;
  to?: BookingPlace;
  travelers: string[];
  details: string;
};

