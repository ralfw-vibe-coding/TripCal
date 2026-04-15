import type { EventStore } from "@ricofritzsche/eventstore";

import type { BookingRecognition } from "../Providers/AI/BookingRecognition.js";
import type { TextExtraction } from "../Providers/AI/TextExtraction.js";
import type { AnalysisTrigger } from "../Providers/BackgroundProcessing/AnalysisTrigger.js";
import type { FileStorage } from "../Providers/Storage/FileStorage.js";
import type { Clock } from "../Providers/Time/Clock.js";

export type ProcessorDependencies = {
  eventStore: EventStore;
  storage: FileStorage;
  clock: Clock;
  textExtraction: TextExtraction;
  bookingRecognition: BookingRecognition;
  analysisTrigger: AnalysisTrigger;
};

