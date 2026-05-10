import type { IngestEmailRequest } from "../../../src/behavior/slices/ingest-email/IngestEmail";
import { getProcessorRuntime } from "../../../src/runtime/singleton";

export async function runEmailIngest(ingestRequest: IngestEmailRequest): Promise<void> {
  try {
    const runtime = await getProcessorRuntime();
    const response = await runtime.processor.ingestEmail(ingestRequest);
    if (response.status === "rejected") {
      console.warn("TripCal email ingest rejected", {
        messageId: ingestRequest.messageId,
        reason: response.reason,
        message: response.message,
      });
    }
  } catch (error) {
    console.error("TripCal email ingest failed", {
      messageId: ingestRequest.messageId,
      subject: ingestRequest.subject,
      attachmentCount: ingestRequest.attachments.length,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    await appendFailureToActivityLog(ingestRequest, error);
  }
}

async function appendFailureToActivityLog(ingestRequest: IngestEmailRequest, error: unknown): Promise<void> {
  try {
    const runtime = await getProcessorRuntime();
    await runtime.activityLogProvider.append({
      level: "error",
      scope: "email-ingest",
      message: "E-Mail-Ingest unerwartet fehlgeschlagen",
      details: {
        documentName: describeIngestRequest(ingestRequest),
        messageId: ingestRequest.messageId,
        subject: ingestRequest.subject,
        attachments: ingestRequest.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        })),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  } catch {
    // If runtime initialization or logging fails, the console error above is the remaining trace.
  }
}

function describeIngestRequest(ingestRequest: IngestEmailRequest): string {
  if (ingestRequest.attachments.length === 1) return `E-Mail-Anhang: ${ingestRequest.attachments[0].fileName}`;
  if (ingestRequest.attachments.length > 1) return `E-Mail mit ${ingestRequest.attachments.length} Anhängen`;
  if (ingestRequest.text?.trim()) return `E-Mail-Text: ${ingestRequest.subject ?? ingestRequest.messageId}`;
  return `E-Mail: ${ingestRequest.subject ?? ingestRequest.messageId}`;
}
