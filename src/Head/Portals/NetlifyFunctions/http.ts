import type { Context } from "@netlify/functions";

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
}

export function internalErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "unknown error";
  return jsonResponse({ success: false, reason: message }, { status: 500 });
}

