import { getProcessorRuntime } from "../../src/runtime/singleton";
import { readDocumentFile } from "../../src/runtime/readDocumentFile";

type NetlifyEvent = {
  httpMethod: string;
  path: string;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const documentFileUploadedId = decodeURIComponent(event.path.split("/").filter(Boolean).at(-1) ?? "");
  if (!documentFileUploadedId || documentFileUploadedId === "documents") {
    return json(404, { message: "Document not found" });
  }

  const runtime = await getProcessorRuntime();
  const result = await readDocumentFile(runtime, documentFileUploadedId);
  if (result.status === "not_found") {
    return json(404, { message: "Document not found" });
  }

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      "content-type": result.mimeType || "application/octet-stream",
      "content-disposition": contentDispositionInline(result.originalFileName),
    },
    body: Buffer.from(result.bytes).toString("base64"),
  };
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function contentDispositionInline(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\\r\n]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
