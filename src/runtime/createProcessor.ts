import { MemoryEventStore, PostgresEventStore } from "@ricofritzsche/eventstore";
import type { EventStore } from "@ricofritzsche/eventstore";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Processor } from "../behavior/Processor";
import { RecordDocumentTextAndExtractBookings } from "../behavior/flows/RecordDocumentTextAndExtractBookings";
import { AssignBookingToTrip } from "../behavior/slices/assign-booking-to-trip/AssignBookingToTrip";
import { CreateTrip } from "../behavior/slices/create-trip/CreateTrip";
import { DeleteBooking } from "../behavior/slices/delete-booking/DeleteBooking";
import { IngestEmail } from "../behavior/slices/ingest-email/IngestEmail";
import { SubmitDocumentImage } from "../behavior/slices/submit-document-image/SubmitDocumentImage";
import { SubmitDocumentFiles } from "../behavior/slices/submit-document-files/SubmitDocumentFiles";
import { SubmitDocumentText } from "../behavior/slices/submit-document-text/SubmitDocumentText";
import { ViewBookingCalendar } from "../behavior/slices/view-booking-calendar/ViewBookingCalendar";
import { ViewTrips } from "../behavior/slices/view-trips/ViewTrips";
import { AssignBookingToTripCommand } from "../domain/rpus/assign-booking-to-trip-command/AssignBookingToTripCommand";
import { CreateTripCommand } from "../domain/rpus/create-trip-command/CreateTripCommand";
import { DeleteBookingCommand } from "../domain/rpus/delete-booking-command/DeleteBookingCommand";
import { GetBookingCalendarQuery } from "../domain/rpus/get-booking-calendar-query/GetBookingCalendarQuery";
import { GetTripsQuery } from "../domain/rpus/get-trips-query/GetTripsQuery";
import { RecordDocumentFileUploadedCommand } from "../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import { RecordEmailIngestedCommand } from "../domain/rpus/record-email-ingested-command/RecordEmailIngestedCommand";
import { RecordExtractedBookingsCommand } from "../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import { SubmitDocumentTextCommand } from "../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../providers/activity-log/ActivityLogProvider";
import { JsonFileActivityLogProvider } from "../providers/activity-log/JsonFileActivityLogProvider";
import { PostgresActivityLogProvider } from "../providers/activity-log/PostgresActivityLogProvider";
import { OpenAIBookingExtractionProvider } from "../providers/booking-extraction/OpenAIBookingExtractionProvider";
import { RuleBasedBookingExtractionProvider } from "../providers/booking-extraction/RuleBasedBookingExtractionProvider";
import { SystemClock } from "../providers/clock/SystemClock";
import { LocalFileStorageProvider } from "../providers/file-storage/LocalFileStorageProvider";
import type { FileStorageProvider } from "../providers/file-storage/FileStorageProvider";
import { R2FileStorageProvider } from "../providers/file-storage/R2FileStorageProvider";
import { CryptoIdGenerator } from "../providers/ids/CryptoIdGenerator";
import { OpenAITextExtractionProvider } from "../providers/text-extraction/OpenAITextExtractionProvider";
import { parseTravelerAliases, TravelerResolver } from "../providers/travelers/TravelerResolver";
import { UnavailableTextExtractionProvider } from "../providers/text-extraction/UnavailableTextExtractionProvider";

export type ProcessorRuntime = {
  eventStore: EventStore;
  fileStorageProvider: FileStorageProvider;
  activityLogProvider: ActivityLogProvider;
  processor: Processor;
};

export async function createProcessorRuntime(eventStore?: EventStore): Promise<ProcessorRuntime> {
  const store = eventStore ?? (await createDefaultEventStore());
  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();
  const extractionProvider = createBookingExtractionProvider();
  const textExtractionProvider = createTextExtractionProvider();
  const travelerResolver = createTravelerResolver();
  const fileStorageProvider = createFileStorageProvider(idGenerator);
  const activityLogProvider = createActivityLogProvider(idGenerator);

  const submitDocumentTextCommand = new SubmitDocumentTextCommand(store, idGenerator);
  const deleteBookingCommand = new DeleteBookingCommand(store, idGenerator, clock);
  const createTripCommand = new CreateTripCommand(store, idGenerator, clock, readInitialTripNumber());
  const assignBookingToTripCommand = new AssignBookingToTripCommand(store, idGenerator, clock);
  const recordEmailIngestedCommand = new RecordEmailIngestedCommand(store, idGenerator);
  const recordDocumentFileUploadedCommand = new RecordDocumentFileUploadedCommand(store, idGenerator);
  const recordExtractedBookingsCommand = new RecordExtractedBookingsCommand(store, idGenerator, travelerResolver);
  const getBookingCalendarQuery = new GetBookingCalendarQuery(store, travelerResolver);
  const getTripsQuery = new GetTripsQuery(store);

  const recordDocumentTextAndExtractBookings = new RecordDocumentTextAndExtractBookings(
    clock,
    activityLogProvider,
    submitDocumentTextCommand,
    extractionProvider,
    recordExtractedBookingsCommand,
  );
  const submitDocumentText = new SubmitDocumentText(recordDocumentTextAndExtractBookings);
  const submitDocumentImage = new SubmitDocumentImage(textExtractionProvider, recordDocumentTextAndExtractBookings);
  const deleteBooking = new DeleteBooking(deleteBookingCommand);
  const createTrip = new CreateTrip(createTripCommand);
  const assignBookingToTrip = new AssignBookingToTrip(assignBookingToTripCommand);
  const ingestEmail = new IngestEmail(
    clock,
    fileStorageProvider,
    textExtractionProvider,
    activityLogProvider,
    recordEmailIngestedCommand,
    recordDocumentFileUploadedCommand,
    recordDocumentTextAndExtractBookings,
  );
  const submitDocumentFiles = new SubmitDocumentFiles(
    clock,
    fileStorageProvider,
    textExtractionProvider,
    recordDocumentFileUploadedCommand,
    recordDocumentTextAndExtractBookings,
  );
  const viewBookingCalendar = new ViewBookingCalendar(getBookingCalendarQuery);
  const viewTrips = new ViewTrips(getTripsQuery);

  return {
    eventStore: store,
    fileStorageProvider,
    activityLogProvider,
    processor: new Processor(
      submitDocumentText,
      submitDocumentImage,
      submitDocumentFiles,
      ingestEmail,
      createTrip,
      assignBookingToTrip,
      deleteBooking,
      viewTrips,
      viewBookingCalendar,
    ),
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
  const storageType = readRuntimeEnv("FILE_STORAGE", "TRIPCAL_FILE_STORAGE")?.trim().toLowerCase() ?? "local";

  if (storageType === "r2") {
    return new R2FileStorageProvider(
      {
        accountId: readRequiredRuntimeEnv("R2_ACCOUNT_ID"),
        bucket: readRequiredRuntimeEnv("R2_BUCKET"),
        accessKeyId: readRequiredRuntimeEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: readRequiredRuntimeEnv("R2_SECRET_ACCESS_KEY"),
        endpoint: readRuntimeEnv("R2_ENDPOINT"),
      },
      idGenerator,
    );
  }

  if (storageType !== "local") {
    throw new Error(`Unsupported FILE_STORAGE value: ${storageType}`);
  }

  return new LocalFileStorageProvider(readRuntimeEnv("LOCAL_FILE_STORAGE_DIR") ?? "data/filestore", idGenerator);
}

function createActivityLogProvider(idGenerator: CryptoIdGenerator): ActivityLogProvider {
  const storeType = readRuntimeEnv("EVENT_STORE", "TRIPCAL_EVENT_STORE")?.trim().toLowerCase() ?? "memory";
  if (storeType === "postgres") {
    return new PostgresActivityLogProvider(readRequiredRuntimeEnv("DATABASE_URL"), idGenerator);
  }

  return new JsonFileActivityLogProvider(readRuntimeEnv("ACTIVITY_LOG_FILE") ?? "data/activity-log/entries.json", idGenerator);
}

function createTravelerResolver() {
  return new TravelerResolver(parseTravelerAliases(readRuntimeEnv("TRAVELERS_JSON")));
}

function readInitialTripNumber(): number {
  const value = Number(readRuntimeEnv("INITIAL_TRIP_NUMBER") ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function readRuntimeEnv(name: string, fallbackName?: string): string | undefined {
  const fromProcess = readProcessEnv(name) ?? (fallbackName ? readProcessEnv(fallbackName) : undefined);
  if (fromProcess) return fromProcess;

  if (!existsSync(".env")) return undefined;

  return readDotEnv(name) ?? (fallbackName ? readDotEnv(fallbackName) : undefined);
}

function readRequiredRuntimeEnv(name: string): string {
  const value = readRuntimeEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
