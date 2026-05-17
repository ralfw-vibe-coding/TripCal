import type { DailyAllowance } from "../../domain/model";

export interface DailyAllowanceProvider {
  listDailyAllowances(): Promise<DailyAllowance[]>;
}
