import type { ProcessorRuntime } from "./createProcessor";

export async function readActivityLog(runtime: ProcessorRuntime, limit = 100) {
  return {
    entries: await runtime.activityLogProvider.listLatest(Math.min(Math.max(limit, 1), 100)),
  };
}
