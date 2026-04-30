import type {
  CorrectBookingCommand,
  CorrectBookingCommandRequest,
  CorrectBookingCommandResponse,
} from "../../../domain/rpus/correct-booking-command/CorrectBookingCommand";

export type CorrectBookingRequest = CorrectBookingCommandRequest;

type CorrectBookingRejectionReason = "missing_booking" | "empty_patch" | "booking_not_found" | "already_deleted";

export type CorrectBookingResponse =
  | {
      status: "accepted";
      bookingCorrectedId: string;
    }
  | {
      status: "rejected";
      reason: CorrectBookingRejectionReason;
      message: string;
    };

export class CorrectBooking {
  constructor(private readonly correctBookingCommand: CorrectBookingCommand) {}

  async process(request: CorrectBookingRequest): Promise<CorrectBookingResponse> {
    const response = await this.correctBookingCommand.process(request);
    if (response.status === "succeeded") {
      return { status: "accepted", bookingCorrectedId: response.bookingCorrectedId };
    }

    return {
      status: "rejected",
      reason: response.reason,
      message: correctBookingMessage(response.reason),
    };
  }
}

function correctBookingMessage(reason: CorrectBookingRejectionReason) {
  const messages: Record<string, string> = {
    missing_booking: "Die Buchung fehlt.",
    empty_patch: "Es wurden keine Änderungen erkannt.",
    booking_not_found: "Die Buchung wurde nicht gefunden.",
    already_deleted: "Die Buchung wurde bereits gelöscht.",
  };
  return messages[String(reason)] ?? "Die Buchung konnte nicht korrigiert werden.";
}
