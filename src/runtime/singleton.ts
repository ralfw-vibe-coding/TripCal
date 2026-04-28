import type { ProcessorRuntime } from "./createProcessor";
import { createProcessorRuntime } from "./createProcessor";

let runtimePromise: Promise<ProcessorRuntime> | undefined;

export function getProcessorRuntime(): Promise<ProcessorRuntime> {
  runtimePromise ??= createProcessorRuntime();
  return runtimePromise;
}

