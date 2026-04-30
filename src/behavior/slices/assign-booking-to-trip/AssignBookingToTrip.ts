import type {
  AssignBookingToTripCommand,
  AssignBookingToTripCommandRequest,
  AssignBookingToTripCommandResponse,
} from "../../../domain/rpus/assign-booking-to-trip-command/AssignBookingToTripCommand";

export type AssignBookingToTripRequest = AssignBookingToTripCommandRequest;
export type AssignBookingToTripResponse = AssignBookingToTripCommandResponse;

export class AssignBookingToTrip {
  constructor(private readonly assignBookingToTripCommand: AssignBookingToTripCommand) {}

  process(request: AssignBookingToTripRequest): Promise<AssignBookingToTripResponse> {
    return this.assignBookingToTripCommand.process(request);
  }
}
