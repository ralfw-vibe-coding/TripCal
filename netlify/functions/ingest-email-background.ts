import { getProcessorRuntime } from "../../src/runtime/singleton";

type NetlifyEvent = {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined>;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const auth = authorize(event.headers ?? {});
  if (!auth.authorized) {
    return json(auth.statusCode, { message: auth.message });
  }

  const body = parseBody(event.body);
  const runtime = await getProcessorRuntime();
  const response = await runtime.processor.ingestEmail(toIngestEmailRequest(body));
  return json(response.status === "accepted" ? 200 : 400, response);
}

function toIngestEmailRequest(body: Record<string, unknown>) {
  const email = typeof body.email === "object" && body.email !== null ? (body.email as Record<string, unknown>) : body;

  return {
    messageId: String(email.messageId ?? email.messageID ?? email.id ?? ""),
    from: optionalString(email.from),
    subject: optionalString(email.subject),
    receivedAt: optionalString(email.receivedAt ?? email.date),
    text: optionalString(email.text ?? email.bodyText ?? body.text),
    attachments: Array.isArray(body.attachments) ? body.attachments.map(toAttachmentInput) : [],
  };
}

function toAttachmentInput(value: unknown) {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    fileName: String(record.fileName ?? record.filename ?? record.name ?? ""),
    mimeType: String(record.mimeType ?? record.contentType ?? record.type ?? "application/octet-stream"),
    dataBase64: String(record.dataBase64 ?? record.data ?? record.content ?? ""),
  };
}

function authorize(headers: Record<string, string | undefined>) {
  const expectedToken = readEnv("EMAIL_INGEST_TOKEN");
  if (!expectedToken) {
    return { authorized: false, statusCode: 500, message: "EMAIL_INGEST_TOKEN is not configured." };
  }

  const authorization = findHeader(headers, "authorization");
  if (authorization !== `Bearer ${expectedToken}`) {
    return { authorized: false, statusCode: 401, message: "Unauthorized." };
  }

  return { authorized: true as const };
}

function findHeader(headers: Record<string, string | undefined>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
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
