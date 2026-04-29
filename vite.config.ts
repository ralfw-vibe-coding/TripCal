import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { getProcessorRuntime } from "./src/runtime/singleton";

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
  response.end(JSON.stringify(body));
}
