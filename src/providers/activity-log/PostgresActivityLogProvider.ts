import pg from "pg";
import type { IdGenerator } from "../ids/IdGenerator";
import type { ActivityLogEntry, ActivityLogProvider, AppendActivityLogEntryRequest } from "./ActivityLogProvider";

const { Pool } = pg;

export class PostgresActivityLogProvider implements ActivityLogProvider {
  private readonly pool: pg.Pool;
  private initialized = false;

  constructor(
    connectionString: string,
    private readonly idGenerator: IdGenerator,
    private readonly maxEntries = 100,
  ) {
    this.pool = new Pool({ connectionString });
  }

  async append(request: AppendActivityLogEntryRequest): Promise<void> {
    await this.initialize();
    await this.pool.query(
      `insert into tripcal_activity_log (id, timestamp, level, scope, message, details)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        this.idGenerator.newId(),
        new Date().toISOString(),
        request.level ?? "info",
        request.scope,
        request.message,
        request.details ? JSON.stringify(request.details) : null,
      ],
    );
    await this.pool.query(
      `delete from tripcal_activity_log
       where id in (
         select id
         from tripcal_activity_log
         order by timestamp desc
         offset $1
       )`,
      [this.maxEntries],
    );
  }

  async listLatest(limit = this.maxEntries): Promise<ActivityLogEntry[]> {
    await this.initialize();
    const result = await this.pool.query(
      `select id, timestamp, level, scope, message, details
       from tripcal_activity_log
       order by timestamp desc
       limit $1`,
      [limit],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      timestamp: new Date(row.timestamp).toISOString(),
      level: row.level,
      scope: String(row.scope),
      message: String(row.message),
      details: row.details ?? undefined,
    }));
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.pool.query(`
      create table if not exists tripcal_activity_log (
        id text primary key,
        timestamp timestamptz not null,
        level text not null,
        scope text not null,
        message text not null,
        details jsonb
      )
    `);
    await this.pool.query(`
      create index if not exists tripcal_activity_log_timestamp_idx
      on tripcal_activity_log (timestamp desc)
    `);

    this.initialized = true;
  }
}
