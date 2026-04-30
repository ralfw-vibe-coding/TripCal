import type {
  GetTripsQuery,
  GetTripsQueryRequest,
  GetTripsQueryResponse,
} from "../../../domain/rpus/get-trips-query/GetTripsQuery";
import type { TravelerResolver } from "../../../providers/travelers/TravelerResolver";

export type ViewTripsRequest = GetTripsQueryRequest;
export type ViewTripsResponse = GetTripsQueryResponse & {
  travelerLabels: string[];
};

export class ViewTrips {
  constructor(
    private readonly getTripsQuery: GetTripsQuery,
    private readonly travelerResolver: TravelerResolver,
  ) {}

  async process(request: ViewTripsRequest = {}): Promise<ViewTripsResponse> {
    const response = await this.getTripsQuery.process(request);
    return {
      ...response,
      travelerLabels: this.travelerResolver.labels(),
    };
  }
}
