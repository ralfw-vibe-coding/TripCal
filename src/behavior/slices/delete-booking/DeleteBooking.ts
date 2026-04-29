import type { DeleteBookingCommand } from "../../../domain/rpus/delete-booking-command/DeleteBookingCommand";

export type DeleteBookingRequest = {
  bookingExtractedId: string;
};

export type DeleteBookingResponse =
  | {
      status: "accepted";
      bookingDeletedId: string;
    }
  | {
      status: "rejected";
      reason: "missing_booking" | "booking_not_found" | "already_deleted";
      message: string;
    };

export class DeleteBooking {
  constructor(private readonly deleteBookingCommand: DeleteBookingCommand) {}

  async process(request: DeleteBookingRequest): Promise<DeleteBookingResponse> {
    if (!request.bookingExtractedId.trim()) {
      return {
        status: "rejected",
        reason: "missing_booking",
        message: "Die Buchung fehlt.",
      };
    }

    const response = await this.deleteBookingCommand.process({ bookingExtractedId: request.bookingExtractedId });
    if (response.status === "succeeded") {
      return {
        status: "accepted",
        bookingDeletedId: response.bookingDeletedId,
      };
    }

    return {
      status: "rejected",
      reason: response.reason,
      message:
        response.reason === "already_deleted"
          ? "Die Buchung wurde bereits gelöscht."
          : "Die Buchung wurde nicht gefunden.",
    };
  }
}
