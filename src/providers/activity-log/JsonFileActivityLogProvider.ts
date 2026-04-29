import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IdGenerator } from "../ids/IdGenerator";
import type { ActivityLogEntry, ActivityLogProvider, AppendActivityLogEntryRequest } from "./ActivityLogProvider";

export class JsonFileActivityLogProvider implements ActivityLogProvider {
  constructor(
    private readonly filename: string,
    private readonly idGenerator: IdGenerator,
    private readonly maxEntries = 100,
  ) {}

  async append(request: AppendActivityLogEntryRequest): Promise<void> {
    const entries = await this.readEntries();
    entries.unshift(toEntry(request, this.idGenerator.newId()));
    await this.writeEntries(entries.slice(0, this.maxEntries));
  }

  async listLatest(limit = this.maxEntries): Promise<ActivityLogEntry[]> {
    return (await this.readEntries()).slice(0, limit);
  }

  private async readEntries(): Promise<ActivityLogEntry[]> {
    try {
      return JSON.parse(await readFile(this.filename, "utf8")) as ActivityLogEntry[];
    } catch {
      return [];
    }
  }

  private async writeEntries(entries: ActivityLogEntry[]): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true });
    await writeFile(this.filename, JSON.stringify(entries, null, 2));
  }
}

function toEntry(request: AppendActivityLogEntryRequest, id: string): ActivityLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    level: request.level ?? "info",
    scope: request.scope,
    message: request.message,
    details: request.details,
  };
}
