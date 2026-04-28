import { MemoryEventStore, PostgresEventStore } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import { Processor } from "../behavior/Processor";
import { SubmitDocumentText } from "../behavior/slices/submit-document-text/SubmitDocumentText";
import { ViewBookingCalendar } from "../behavior/slices/view-booking-calendar/ViewBookingCalendar";
import { GetBookingCalendarQuery } from "../domain/rpus/get-booking-calendar-query/GetBookingCalendarQuery";
import { RecordExtractedBookingsCommand } from "../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import { RuleBasedBookingExtractionProvider } from "../providers/booking-extraction/RuleBasedBookingExtractionProvider";
import { SystemClock } from "../providers/clock/SystemClock";
import { CryptoIdGenerator } from "../providers/ids/CryptoIdGenerator";

export type ProcessorRuntime = {
  eventStore: EventStore;
  processor: Processor;
};

export async function createProcessorRuntime(eventStore?: EventStore): Promise<ProcessorRuntime> {
  const store = eventStore ?? (await createDefaultEventStore());
  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();
  const extractionProvider = new RuleBasedBookingExtractionProvider();

  const submitDocumentTextCommand = new SubmitDocumentTextCommand(store, idGenerator);
  const recordExtractedBookingsCommand = new RecordExtractedBookingsCommand(store, idGenerator);
  const getBookingCalendarQuery = new GetBookingCalendarQuery(store);

  const submitDocumentText = new SubmitDocumentText(
    clock,
    submitDocumentTextCommand,
    extractionProvider,
    recordExtractedBookingsCommand,
  );
  const viewBookingCalendar = new ViewBookingCalendar(getBookingCalendarQuery);

  return {
    eventStore: store,
    processor: new Processor(submitDocumentText, viewBookingCalendar),
  };
}

async function createDefaultEventStore(): Promise<EventStore> {
  const storeType = process.env.TRIPCAL_EVENT_STORE?.trim().toLowerCase() ?? "memory";

  if (storeType === "postgres") {
    const eventStore = new PostgresEventStore({
      connectionString: process.env.DATABASE_URL,
    });
    await eventStore.initializeDatabase();
    return eventStore;
  }

  if (storeType !== "memory") {
    throw new Error(`Unsupported TRIPCAL_EVENT_STORE value: ${storeType}`);
  }

  const filename = process.env.TRIPCAL_MEMORY_EVENT_STORE_FILE ?? "/tmp/tripcal-memory-eventstore.json";
  return MemoryEventStore.createFromFile(filename, true, true);
}
