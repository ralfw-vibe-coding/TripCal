import { validateDocumentFiles } from "./_shared/document-file-validation";
import { parseIngestEmailRequest } from "./_shared/ingest-email-request";
import { runEmailIngest } from "./_shared/run-email-ingest";

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

  const validation = validateDocumentFiles(ingestRequest.attachments);
  if (validation.status === "rejected") {
    return json(415, {
      status: "rejected",
      reason: "unsupported_file_type",
      message: validation.message,
      unsupportedFileNames: validation.unsupportedFileNames,
    });
  }

  const response = await runEmailIngest(ingestRequest);

  return json(response.status === "accepted" ? 200 : 422, response);
};

export const config = {
  path: "/api/ingest-email",
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

declare global {
  var Netlify:
    | {
        env: {
          get(name: string): string | undefined;
        };
      }
    | undefined;
}
