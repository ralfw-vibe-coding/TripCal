import type { IngestEmailRequest } from "../../../src/behavior/slices/ingest-email/IngestEmail";
import type { EmailPartKind } from "../../../src/domain/events/events";

type RawBody = Record<string, unknown>;

export type HeaderReader = {
  get(name: string): string | null;
};

export async function parseIngestEmailRequest(request: Request): Promise<IngestEmailRequest> {
  if (isMultipart(request.headers)) {
    return parseMultipartIngestEmailRequest(await request.formData());
  }

  return toIngestEmailRequest(await parseJsonBody(request));
}

export function toIngestEmailRequest(body: RawBody): IngestEmailRequest {
  const root = typeof body.payload === "object" && body.payload !== null ? (body.payload as RawBody) : body;
  const email = typeof root.email === "object" && root.email !== null ? (root.email as RawBody) : root;

  return {
    messageId: String(email.messageId ?? email.messageID ?? email.id ?? ""),
    originalMessageId: optionalString(email.originalMessageId ?? root.originalMessageId),
    part: toPartInfo(root.part ?? email.part ?? root.partInfo ?? email.partInfo),
    from: optionalString(email.from),
    subject: optionalString(email.subject),
    receivedAt: optionalString(email.receivedAt ?? email.date),
    text: optionalString(email.text ?? email.bodyText ?? root.text),
    attachments: Array.isArray(root.attachments) ? root.attachments.map(toAttachmentInput) : [],
  };
}

function toPartInfo(value: unknown) {
  const record = typeof value === "object" && value !== null ? (value as RawBody) : {};
  const partKind: EmailPartKind | undefined =
    record.partKind === "attachment" ? "attachment" : record.partKind === "body" ? "body" : undefined;
  const part = {
    originalMessageId: optionalString(record.originalMessageId),
    partId: optionalString(record.partId),
    partIndex: optionalNumber(record.partIndex),
    partCount: optionalNumber(record.partCount),
    partKind,
  };
  return Object.values(part).some((value) => value !== undefined) ? part : undefined;
}

export function toAttachmentInput(value: unknown) {
  const record = typeof value === "object" && value !== null ? (value as RawBody) : {};
  return {
    fileName: String(record.fileName ?? record.filename ?? record.name ?? ""),
    mimeType: String(record.mimeType ?? record.contentType ?? record.type ?? "application/octet-stream"),
    dataBase64: String(record.dataBase64 ?? record.data ?? record.content ?? ""),
  };
}

function isMultipart(headers: HeaderReader): boolean {
  return headers.get("content-type")?.toLowerCase().includes("multipart/form-data") ?? false;
}

async function parseMultipartIngestEmailRequest(formData: FormData): Promise<IngestEmailRequest> {
  const raw = parseMultipartFields(formData);
  const files = await parseMultipartFiles(formData);
  const request = toIngestEmailRequest(raw);
  return {
    ...request,
    attachments: files.length > 0 ? files : request.attachments,
  };
}

function parseMultipartFields(formData: FormData): RawBody {
  const raw: RawBody = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    raw[key] = value;
  }

  parseJsonField(raw, "email");
  parseJsonField(raw, "payload");

  return raw;
}

function parseJsonField(raw: RawBody, fieldName: string): void {
  if (typeof raw[fieldName] !== "string") return;
  try {
    raw[fieldName] = JSON.parse(raw[fieldName]) as RawBody;
  } catch {
    raw[fieldName] = {};
  }
}

async function parseMultipartFiles(formData: FormData) {
  const attachments = [];
  for (const [_key, value] of formData.entries()) {
    if (!(value instanceof File)) continue;
    if (value.size === 0) continue;
    attachments.push({
      fileName: value.name || "attachment",
      mimeType: value.type || "application/octet-stream",
      dataBase64: Buffer.from(await value.arrayBuffer()).toString("base64"),
    });
  }
  return attachments;
}

async function parseJsonBody(request: Request): Promise<RawBody> {
  try {
    return (await request.json()) as RawBody;
  } catch {
    return {};
  }
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}
