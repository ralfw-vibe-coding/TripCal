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
  const response = await runtime.processor.correctTrip({
    tripCreatedId: String(body.tripCreatedId ?? ""),
    shortCode: String(body.shortCode ?? ""),
    title: optionalString(body.title),
    owner: String(body.owner ?? ""),
    startDate: String(body.startDate ?? ""),
    endDate: String(body.endDate ?? ""),
  });
  return json(response.status === "succeeded" ? 200 : 400, response);
}

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
