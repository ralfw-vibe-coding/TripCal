export type ActivityLogLevel = "info" | "warning" | "error";

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  level: ActivityLogLevel;
  scope: string;
  message: string;
  details?: Record<string, unknown>;
};

export type AppendActivityLogEntryRequest = {
  level?: ActivityLogLevel;
  scope: string;
  message: string;
  details?: Record<string, unknown>;
};

export interface ActivityLogProvider {
  append(request: AppendActivityLogEntryRequest): Promise<void>;
  listLatest(limit?: number): Promise<ActivityLogEntry[]>;
}
