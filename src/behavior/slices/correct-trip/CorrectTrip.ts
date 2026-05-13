import type {
  CorrectTripCommand,
  CorrectTripCommandRequest,
  CorrectTripCommandResponse,
} from "../../../domain/rpus/correct-trip-command/CorrectTripCommand";

export type CorrectTripRequest = CorrectTripCommandRequest;
export type CorrectTripResponse = CorrectTripCommandResponse;

export class CorrectTrip {
  constructor(private readonly correctTripCommand: CorrectTripCommand) {}

  process(request: CorrectTripRequest): Promise<CorrectTripResponse> {
    return this.correctTripCommand.process(request);
  }
}
