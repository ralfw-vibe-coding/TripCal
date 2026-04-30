import type {
  GetTripsQuery,
  GetTripsQueryRequest,
  GetTripsQueryResponse,
} from "../../../domain/rpus/get-trips-query/GetTripsQuery";

export type ViewTripsRequest = GetTripsQueryRequest;
export type ViewTripsResponse = GetTripsQueryResponse;

export class ViewTrips {
  constructor(private readonly getTripsQuery: GetTripsQuery) {}

  process(request: ViewTripsRequest = {}): Promise<ViewTripsResponse> {
    return this.getTripsQuery.process(request);
  }
}
