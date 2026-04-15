import { createProcessor as createBodyProcessor } from "../../Body/Processor/createProcessor.js";
import type { Processor } from "../../Body/Processor/Processor.js";
import { createDependencies, type CreateDependenciesOptions } from "./createDependencies.js";

export function createProcessor(options: CreateDependenciesOptions): Processor {
  return createBodyProcessor(createDependencies(options));
}

