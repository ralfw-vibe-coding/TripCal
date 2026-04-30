import type {
  ChangeBookingStatusCommand,
  ChangeBookingStatusCommandRequest,
} from "../../../domain/rpus/change-booking-status-command/ChangeBookingStatusCommand";

export type ChangeBookingStatusRequest = ChangeBookingStatusCommandRequest;

type ChangeBookingStatusRejectionReason = "missing_booking" | "invalid_status" | "booking_not_found" | "already_deleted";

export type ChangeBookingStatusResponse =
  | {
      status: "accepted";
      bookingStatusChangedId: string;
    }
  | {
      status: "rejected";
      reason: ChangeBookingStatusRejectionReason;
      message: string;
    };

export class ChangeBookingStatus {
  constructor(private readonly command: ChangeBookingStatusCommand) {}

  async process(request: ChangeBookingStatusRequest): Promise<ChangeBookingStatusResponse> {
    const response = await this.command.process(request);
    if (response.status === "succeeded") {
      return { status: "accepted", bookingStatusChangedId: response.bookingStatusChangedId };
    }

    return {
      status: "rejected",
      reason: response.reason,
      message: changeBookingStatusMessage(response.reason),
    };
  }
}

function changeBookingStatusMessage(reason: ChangeBookingStatusRejectionReason) {
  const messages: Record<string, string> = {
    missing_booking: "Die Buchung fehlt.",
    invalid_status: "Der Status ist ungültig.",
    booking_not_found: "Die Buchung wurde nicht gefunden.",
    already_deleted: "Die Buchung wurde bereits gelöscht.",
  };
  return messages[String(reason)] ?? "Der Status konnte nicht geändert werden.";
}
