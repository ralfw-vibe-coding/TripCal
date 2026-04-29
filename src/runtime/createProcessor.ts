import { MemoryEventStore, PostgresEventStore } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Processor } from "../behavior/Processor";
import { RecordDocumentTextAndExtractBookings } from "../behavior/flows/RecordDocumentTextAndExtractBookings";
import { SubmitDocumentImage } from "../behavior/slices/submit-document-image/SubmitDocumentImage";
import { SubmitDocumentFiles } from "../behavior/slices/submit-document-files/SubmitDocumentFiles";
import { SubmitDocumentText } from "../behavior/slices/submit-document-text/SubmitDocumentText";
import { ViewBookingCalendar } from "../behavior/slices/view-booking-calendar/ViewBookingCalendar";
import { GetBookingCalendarQuery } from "../domain/rpus/get-booking-calendar-query/GetBookingCalendarQuery";
import { RecordDocumentFileUploadedCommand } from "../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import { RecordExtractedBookingsCommand } from "../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import { OpenAIBookingExtractionProvider } from "../providers/booking-extraction/OpenAIBookingExtractionProvider";
import { RuleBasedBookingExtractionProvider } from "../providers/booking-extraction/RuleBasedBookingExtractionProvider";
import { SystemClock } from "../providers/clock/SystemClock";
import { LocalFileStorageProvider } from "../providers/file-storage/LocalFileStorageProvider";
import { CryptoIdGenerator } from "../providers/ids/CryptoIdGenerator";
import { OpenAITextExtractionProvider } from "../providers/text-extraction/OpenAITextExtractionProvider";
import { UnavailableTextExtractionProvider } from "../providers/text-extraction/UnavailableTextExtractionProvider";

export type ProcessorRuntime = {
  eventStore: EventStore;
  processor: Processor;
};

export async function createProcessorRuntime(eventStore?: EventStore): Promise<ProcessorRuntime> {
  const store = eventStore ?? (await createDefaultEventStore());
  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();
  const extractionProvider = createBookingExtractionProvider();
  const textExtractionProvider = createTextExtractionProvider();
  const fileStorageProvider = createFileStorageProvider(idGenerator);

  const submitDocumentTextCommand = new SubmitDocumentTextCommand(store, idGenerator);
  const recordDocumentFileUploadedCommand = new RecordDocumentFileUploadedCommand(store, idGenerator);
  const recordExtractedBookingsCommand = new RecordExtractedBookingsCommand(store, idGenerator);
  const getBookingCalendarQuery = new GetBookingCalendarQuery(store);

  const recordDocumentTextAndExtractBookings = new RecordDocumentTextAndExtractBookings(
    clock,
    submitDocumentTextCommand,
    extractionProvider,
    recordExtractedBookingsCommand,
  );
  const submitDocumentText = new SubmitDocumentText(recordDocumentTextAndExtractBookings);
  const submitDocumentImage = new SubmitDocumentImage(textExtractionProvider, recordDocumentTextAndExtractBookings);
  const submitDocumentFiles = new SubmitDocumentFiles(
    clock,
    fileStorageProvider,
    textExtractionProvider,
    recordDocumentFileUploadedCommand,
    recordDocumentTextAndExtractBookings,
  );
  const viewBookingCalendar = new ViewBookingCalendar(getBookingCalendarQuery);

  return {
    eventStore: store,
    processor: new Processor(submitDocumentText, submitDocumentImage, submitDocumentFiles, viewBookingCalendar),
  };
}

async function createDefaultEventStore(): Promise<EventStore> {
  const storeType = readRuntimeEnv("EVENT_STORE", "TRIPCAL_EVENT_STORE")?.trim().toLowerCase() ?? "memory";

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

  const filename =
    readRuntimeEnv("MEMORY_EVENT_STORE_FILE", "TRIPCAL_MEMORY_EVENT_STORE_FILE") ?? "data/eventstore/events.json";
  await mkdir(dirname(filename), { recursive: true });
  return MemoryEventStore.createFromFile(filename, true, true);
}

function createBookingExtractionProvider() {
  const apiKey = readRuntimeEnv("OPENAI_API_KEY");
  if (apiKey) {
    return new OpenAIBookingExtractionProvider(apiKey, readRuntimeEnv("OPENAI_MODEL") ?? "gpt-5.4-mini");
  }

  return new RuleBasedBookingExtractionProvider();
}

function createTextExtractionProvider() {
  const apiKey = readRuntimeEnv("OPENAI_API_KEY");
  if (apiKey) {
    return new OpenAITextExtractionProvider(apiKey, readRuntimeEnv("OPENAI_MODEL") ?? "gpt-5.4-mini");
  }

  return new UnavailableTextExtractionProvider();
}

function createFileStorageProvider(idGenerator: CryptoIdGenerator) {
  return new LocalFileStorageProvider(
    readRuntimeEnv("LOCAL_FILE_STORAGE_DIR", "TRIPCAL_LOCAL_FILE_STORAGE_DIR") ?? "data/filestore",
    idGenerator,
  );
}

function readRuntimeEnv(name: string, fallbackName?: string): string | undefined {
  const fromProcess = readProcessEnv(name) ?? (fallbackName ? readProcessEnv(fallbackName) : undefined);
  if (fromProcess) return fromProcess;

  if (!existsSync(".env")) return undefined;

  return readDotEnv(name) ?? (fallbackName ? readDotEnv(fallbackName) : undefined);
}

function readProcessEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readDotEnv(name: string): string | undefined {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => new RegExp(`^\\s*${escapeRegExp(name)}\\s*=`).test(entry));
  const value = line?.replace(new RegExp(`^\\s*${escapeRegExp(name)}\\s*=\\s*`), "").trim();
  return value && value.length > 0 ? unquote(value) : undefined;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
