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
  serviceIdentifier?: string;
  operator?: string;
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
  sourceDocument?: {
    documentFileUploadedId: string;
    originalFileName: string;
  };
  title: string;
  type: BookingType;
  serviceIdentifier?: string;
  operator?: string;
  status: BookingStatus;
  start: BookingDateTime;
  end?: BookingDateTime;
  from?: BookingPlace;
  to?: BookingPlace;
  travelers: string[];
  rawTravelers?: string[];
  details: string;
  processedAt: string;
  trip?: CalendarTripReference;
};

export type Trip = {
  tripCreatedId: string;
  tripNumber: number;
  shortCode: string;
  title?: string;
  owner: string;
  startDate: string;
  endDate: string;
  color: string;
};

export type CalendarTripReference = {
  tripCreatedId: string;
  shortCode: string;
  color: string;
  owner: string;
};
