import type { GetTripDailyAllowancesQuery } from "../../../domain/rpus/get-trip-daily-allowances-query/GetTripDailyAllowancesQuery";
import type { GetTripsQuery } from "../../../domain/rpus/get-trips-query/GetTripsQuery";
import type { DailyAllowance, Trip, TripDailyAllowanceAssignment, TripReport, TripReportDay } from "../../../domain/model";
import type { DailyAllowanceProvider } from "../../../providers/daily-allowances/DailyAllowanceProvider";

export type ViewTripReportsRequest = Record<string, never>;

export type ViewTripReportsResponse = {
  reports: TripReport[];
  dailyAllowances: DailyAllowance[];
};

export class ViewTripReports {
  constructor(
    private readonly getTripsQuery: GetTripsQuery,
    private readonly getTripDailyAllowancesQuery: GetTripDailyAllowancesQuery,
    private readonly dailyAllowanceProvider: DailyAllowanceProvider,
  ) {}

  async process(_request: ViewTripReportsRequest = {}): Promise<ViewTripReportsResponse> {
    const [trips, assignments, dailyAllowances] = await Promise.all([
      this.getTripsQuery.process({}),
      this.getTripDailyAllowancesQuery.process({}),
      this.dailyAllowanceProvider.listDailyAllowances(),
    ]);
    return {
      reports: trips.trips.map((trip) => toTripReport(trip, assignments.assignmentsByTripId[trip.tripCreatedId] ?? [])),
      dailyAllowances,
    };
  }
}

function toTripReport(trip: Trip, assignments: TripDailyAllowanceAssignment[]): TripReport {
  const assignmentsByDate = new Map(assignments.map((assignment) => [assignment.date, assignment]));
  return {
    trip,
    assignments,
    days: daysInRange(trip.startDate, trip.endDate).map((date, index): TripReportDay => ({
      index: index + 1,
      date,
      assignment: assignmentsByDate.get(date),
    })),
  };
}

function daysInRange(startDate: string, endDate: string): string[] {
  const dayCount = daysBetween(startDate, endDate);
  if (dayCount < 0 || dayCount > 370) return [];
  const startTime = Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) - 1, Number(startDate.slice(8, 10)));
  if (!Number.isFinite(startTime)) return [];
  return Array.from({ length: dayCount + 1 }, (_, index) => {
    const date = new Date(startTime + index * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
}

function daysBetween(first: string, second: string): number {
  const firstTime = Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, Number(first.slice(8, 10)));
  const secondTime = Date.UTC(Number(second.slice(0, 4)), Number(second.slice(5, 7)) - 1, Number(second.slice(8, 10)));
  return Math.round((secondTime - firstTime) / 86_400_000);
}
