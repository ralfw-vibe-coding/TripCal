import { getProcessorRuntime } from "../../src/runtime/singleton";

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const auth = authorize(request.headers);
  if (!auth.authorized) {
    return json(auth.statusCode, { message: auth.message });
  }

  const body = await parseBody(request);
  const runtime = await getProcessorRuntime();
  await runtime.processor.ingestEmail(toIngestEmailRequest(body));

  return json(202, { status: "accepted" });
};

export const config = {
  path: "/api/ingest-email-background",
};

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

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
