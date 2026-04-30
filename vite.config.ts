import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { getProcessorRuntime } from "./src/runtime/singleton";
import { readDocumentFile } from "./src/runtime/readDocumentFile";
import { readActivityLog } from "./src/runtime/readActivityLog";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), tripCalApiPlugin()],
    server: {
      port: 5173,
    },
  };
});

function tripCalApiPlugin() {
  return {
    name: "tripcal-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/view-booking-calendar", async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const runtime = await getProcessorRuntime();
        sendJson(response, 200, await runtime.processor.viewBookingCalendar({}));
      });

      server.middlewares.use("/api/submit-document-text", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.submitDocumentText({ text: String(body.text ?? "") });
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/activity-log", async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const runtime = await getProcessorRuntime();
        sendJson(response, 200, await readActivityLog(runtime, 100));
      });

      server.middlewares.use("/api/submit-document-image", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.submitDocumentImage({
          imageDataUrl: String(body.imageDataUrl ?? ""),
          mimeType: String(body.mimeType ?? ""),
        });
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/view-trips", async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const runtime = await getProcessorRuntime();
        sendJson(response, 200, await runtime.processor.viewTrips({}));
      });

      server.middlewares.use("/api/create-trip", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.createTrip({
          shortCode: String(body.shortCode ?? ""),
          title: optionalString(body.title),
          owner: String(body.owner ?? ""),
          startDate: String(body.startDate ?? ""),
          endDate: String(body.endDate ?? ""),
        });
        sendJson(response, result.status === "succeeded" ? 200 : 400, result);
      });

      server.middlewares.use("/api/assign-booking-to-trip", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.assignBookingToTrip({
          bookingExtractedId: String(body.bookingExtractedId ?? ""),
          tripCreatedId: String(body.tripCreatedId ?? ""),
        });
        sendJson(response, result.status === "succeeded" ? 200 : 400, result);
      });

      server.middlewares.use("/api/correct-booking", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.correctBooking({
          bookingExtractedId: String(body.bookingExtractedId ?? ""),
          patch: typeof body.patch === "object" && body.patch !== null ? body.patch : {},
        });
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/submit-document-files", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.submitDocumentFiles({
          files: Array.isArray(body.files) ? body.files.map(toFileInput) : [],
        });
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/ingest-email", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const auth = authorizeIngestEmail(request.headers);
        if (!auth.authorized) {
          sendJson(response, auth.statusCode, { message: auth.message });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.ingestEmail(toIngestEmailRequest(body));
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/delete-booking", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }
        const body = await readJsonBody(request);
        const runtime = await getProcessorRuntime();
        const result = await runtime.processor.deleteBooking({
          bookingExtractedId: String(body.bookingExtractedId ?? ""),
        });
        sendJson(response, result.status === "accepted" ? 200 : 400, result);
      });

      server.middlewares.use("/api/documents", async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { message: "Method not allowed" });
          return;
        }

        const documentFileUploadedId = request.url?.replace(/^\/+/, "");
        if (!documentFileUploadedId) {
          sendJson(response, 404, { message: "Document not found" });
          return;
        }

        const runtime = await getProcessorRuntime();
        const result = await readDocumentFile(runtime, decodeURIComponent(documentFileUploadedId));
        if (result.status === "not_found") {
          sendJson(response, 404, { message: "Document not found" });
          return;
        }

        response.statusCode = 200;
        response.setHeader("content-type", result.mimeType || "application/octet-stream");
        response.setHeader("content-disposition", contentDispositionInline(result.originalFileName));
        response.end(Buffer.from(result.bytes));
      });
    },
  };
}

function toFileInput(value: unknown) {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    fileName: String(record.fileName ?? ""),
    mimeType: String(record.mimeType ?? ""),
    dataBase64: String(record.dataBase64 ?? ""),
    dataUrl: String(record.dataUrl ?? ""),
  };
}

function toIngestEmailRequest(body: Record<string, unknown>) {
  const email = typeof body.email === "object" && body.email !== null ? (body.email as Record<string, unknown>) : body;

  return {
    messageId: String(email.messageId ?? email.messageID ?? email.id ?? ""),
    from: optionalString(email.from),
    subject: optionalString(email.subject),
    receivedAt: optionalString(email.receivedAt ?? email.date),
    text: optionalString(email.text ?? email.bodyText ?? body.text),
    attachments: Array.isArray(body.attachments) ? body.attachments.map(toEmailAttachmentInput) : [],
  };
}

function toEmailAttachmentInput(value: unknown) {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    fileName: String(record.fileName ?? record.filename ?? record.name ?? ""),
    mimeType: String(record.mimeType ?? record.contentType ?? record.type ?? "application/octet-stream"),
    dataBase64: String(record.dataBase64 ?? record.data ?? record.content ?? ""),
  };
}

function authorizeIngestEmail(headers: import("node:http").IncomingHttpHeaders) {
  const expectedToken = process.env.EMAIL_INGEST_TOKEN?.trim();
  if (!expectedToken) {
    return { authorized: false, statusCode: 500, message: "EMAIL_INGEST_TOKEN is not configured." };
  }

  if (headers.authorization !== `Bearer ${expectedToken}`) {
    return { authorized: false, statusCode: 401, message: "Unauthorized." };
  }

  return { authorized: true as const };
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sendJson(response: import("node:http").ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body, null, 2));
}

function contentDispositionInline(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\\r\n]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
