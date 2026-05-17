import type {
  SetTripDailyAllowancesCommand,
  SetTripDailyAllowancesCommandRequest,
  SetTripDailyAllowancesCommandResponse,
} from "../../../domain/rpus/set-trip-daily-allowances-command/SetTripDailyAllowancesCommand";

export type SetTripDailyAllowancesRequest = SetTripDailyAllowancesCommandRequest;
export type SetTripDailyAllowancesResponse = SetTripDailyAllowancesCommandResponse;

export class SetTripDailyAllowances {
  constructor(private readonly setTripDailyAllowancesCommand: SetTripDailyAllowancesCommand) {}

  process(request: SetTripDailyAllowancesRequest): Promise<SetTripDailyAllowancesResponse> {
    return this.setTripDailyAllowancesCommand.process(request);
  }
}
