export type BookingType =
  | "accommodation"
  | "flight"
  | "train"
  | "bus"
  | "rentalCar"
  | "ship"
  | "activity"
  | "other";

export type TimeRange = {
  start: string;
  end: string;
};

export type Location = {
  from?: string;
  to?: string;
};

export type Booking = {
  bookingRegisteredId: string;
  type: BookingType;
  title: string;
  details: string;
  time: TimeRange;
  location: Location;
  documentStoredId: string;
};

