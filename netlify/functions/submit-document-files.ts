import { getProcessorRuntime } from "../../src/runtime/singleton";
import { validateDocumentFiles } from "./_shared/document-file-validation";

type NetlifyEvent = {
  httpMethod: string;
  body: string | null;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const body = parseBody(event.body);
  const files = Array.isArray(body.files) ? body.files.map(toFileInput) : [];
  const validation = validateDocumentFiles(files);
  if (validation.status === "rejected") {
    return json(415, {
      status: "rejected",
      reason: "unsupported_file_type",
      message: validation.message,
      unsupportedFileNames: validation.unsupportedFileNames,
    });
  }

  const runtime = await getProcessorRuntime();
  const response = await runtime.processor.submitDocumentFiles({
    files,
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
