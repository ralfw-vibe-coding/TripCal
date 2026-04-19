import "dotenv/config";

import type { Processor } from "../../../Body/Processor/Processor.js";
import { HttpAnalysisTrigger } from "../../../Body/Providers/BackgroundProcessing/HttpAnalysisTrigger.js";
import { NoopAnalysisTrigger } from "../../../Body/Providers/BackgroundProcessing/NoopAnalysisTrigger.js";
import { createProcessor } from "../../Application/createProcessor.js";
import { createEventStoreFromEnvironment } from "../../Application/createEventStore.js";

let processorPromise: Promise<Processor> | undefined;

export async function createPortalProcessor(): Promise<Processor> {
  if (!processorPromise) {
    processorPromise = buildProcessor();
  }

  return processorPromise;
}

async function buildProcessor(): Promise<Processor> {
  const eventStore = await createEventStoreFromEnvironment(process.env);
  const analyzeNextDocumentUrl = resolveAnalyzeNextDocumentUrl(process.env);

  return createProcessor({
    eventStore,
    storageRootDirectory:
      process.env.TRIPCAL_STORAGE_ROOT ?? ".tripcal-storage",
    analysisTrigger: analyzeNextDocumentUrl
      ? new HttpAnalysisTrigger(analyzeNextDocumentUrl)
      : new NoopAnalysisTrigger()
  });
}

function resolveAnalyzeNextDocumentUrl(
  environment: NodeJS.ProcessEnv
): string | undefined {
  if (environment.TRIPCAL_ANALYZE_NEXT_DOCUMENT_URL) {
    return environment.TRIPCAL_ANALYZE_NEXT_DOCUMENT_URL;
  }

  const siteUrl = environment.URL ?? environment.DEPLOY_URL ?? environment.TRIPCAL_BASE_URL;
  if (!siteUrl) {
    return undefined;
  }

  return `${siteUrl.replace(/\/$/, "")}/.netlify/functions/analyze-next-document-background`;
}
