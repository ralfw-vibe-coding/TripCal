import { getProcessorRuntime } from "../../src/runtime/singleton";

type NetlifyEvent = {
  httpMethod: string;
  body: string | null;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const body = parseBody(event.body);
  const runtime = await getProcessorRuntime();
  const response = await runtime.processor.submitDocumentFiles({
    files: Array.isArray(body.files) ? body.files.map(toFileInput) : [],
  });
  return json(response.status === "accepted" ? 200 : 400, response);
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

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
