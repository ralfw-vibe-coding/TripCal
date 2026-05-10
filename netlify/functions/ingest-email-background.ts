import { getProcessorRuntime } from "../../src/runtime/singleton";
import { parseIngestEmailRequest } from "./_shared/ingest-email-request";

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const auth = authorize(request.headers);
  if (!auth.authorized) {
    return json(auth.statusCode, { message: auth.message });
  }

  let ingestRequest;
  try {
    ingestRequest = await parseIngestEmailRequest(request);
  } catch (error) {
    return json(400, {
      message: "E-Mail-Ingest konnte nicht gelesen werden.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

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

  return json(202, { status: "accepted" });
};

export const config = {
  path: "/api/ingest-email-background",
};

function authorize(headers: Headers) {
  const expectedToken = readEnv("EMAIL_INGEST_TOKEN");
  if (!expectedToken) {
    return { authorized: false, statusCode: 500, message: "EMAIL_INGEST_TOKEN is not configured." };
  }

  if (headers.get("authorization") !== `Bearer ${expectedToken}`) {
    return { authorized: false, statusCode: 401, message: "Unauthorized." };
  }

  return { authorized: true as const };
}

function readEnv(name: string): string | undefined {
  const fromNetlify = globalThis.Netlify?.env.get(name)?.trim();
  if (fromNetlify) return fromNetlify;

  const fromProcess = process.env[name]?.trim();
  return fromProcess && fromProcess.length > 0 ? fromProcess : undefined;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function appendFailureToActivityLog(
  ingestRequest: {
    messageId: string;
    subject?: string;
    attachments: Array<{ fileName: string; mimeType: string }>;
  },
  error: unknown,
): Promise<void> {
  try {
    const runtime = await getProcessorRuntime();
    await runtime.activityLogProvider.append({
      level: "error",
      scope: "email-ingest",
      message: "E-Mail-Ingest unerwartet fehlgeschlagen",
      details: {
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

declare global {
  var Netlify:
    | {
        env: {
          get(name: string): string | undefined;
        };
      }
    | undefined;
}
