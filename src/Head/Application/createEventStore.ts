import { MemoryEventStore, PostgresEventStore, type EventStore } from "@ricofritzsche/eventstore";

export async function createEventStoreFromEnvironment(
  environment: NodeJS.ProcessEnv
): Promise<EventStore> {
  const configuredMode = environment.TRIPCAL_EVENTSTORE?.trim().toLowerCase();
  const mode = configuredMode === "postgres" ? "postgres" : "memory";

  if (mode === "memory") {
    return new MemoryEventStore();
  }

  const connectionString = environment.TRIPCAL_POSTGRES_URL ?? environment.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "TRIPCAL_POSTGRES_URL or POSTGRES_URL must be configured when TRIPCAL_EVENTSTORE=postgres"
    );
  }

  const eventStore = new PostgresEventStore({ connectionString });
  await eventStore.initializeDatabase();
  return eventStore;
}

