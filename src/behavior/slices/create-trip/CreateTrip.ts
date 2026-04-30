import type {
  CreateTripCommand,
  CreateTripCommandRequest,
  CreateTripCommandResponse,
} from "../../../domain/rpus/create-trip-command/CreateTripCommand";

export type CreateTripRequest = CreateTripCommandRequest;
export type CreateTripResponse = CreateTripCommandResponse;

export class CreateTrip {
  constructor(private readonly createTripCommand: CreateTripCommand) {}

  process(request: CreateTripRequest): Promise<CreateTripResponse> {
    return this.createTripCommand.process(request);
  }
}
