import type { EventStore } from "@ricofritzsche/eventstore";

import type { ProcessorDependencies } from "../../Body/Processor/Dependencies.js";
import type { BookingRecognition } from "../../Body/Providers/AI/BookingRecognition.js";
import { StubBookingRecognition } from "../../Body/Providers/AI/BookingRecognition.js";
import type { TextExtraction } from "../../Body/Providers/AI/TextExtraction.js";
import { StubTextExtraction } from "../../Body/Providers/AI/StubTextExtraction.js";
import type { AnalysisTrigger } from "../../Body/Providers/BackgroundProcessing/AnalysisTrigger.js";
import { NoopAnalysisTrigger } from "../../Body/Providers/BackgroundProcessing/NoopAnalysisTrigger.js";
import type { FileStorage } from "../../Body/Providers/Storage/FileStorage.js";
import { LocalFileStorage } from "../../Body/Providers/Storage/LocalFileStorage.js";
import type { Clock } from "../../Body/Providers/Time/Clock.js";
import { SystemClock } from "../../Body/Providers/Time/SystemClock.js";

export type CreateDependenciesOptions = {
  eventStore: EventStore;
  storage?: FileStorage;
  clock?: Clock;
  textExtraction?: TextExtraction;
  bookingRecognition?: BookingRecognition;
  analysisTrigger?: AnalysisTrigger;
  storageRootDirectory?: string;
};

export function createDependencies(
  options: CreateDependenciesOptions
): ProcessorDependencies {
  return {
    eventStore: options.eventStore,
    storage:
      options.storage ??
      new LocalFileStorage(options.storageRootDirectory ?? ".tripcal-storage"),
    clock: options.clock ?? new SystemClock(),
    textExtraction: options.textExtraction ?? new StubTextExtraction(),
    bookingRecognition: options.bookingRecognition ?? new StubBookingRecognition(),
    analysisTrigger: options.analysisTrigger ?? new NoopAnalysisTrigger()
  };
}

