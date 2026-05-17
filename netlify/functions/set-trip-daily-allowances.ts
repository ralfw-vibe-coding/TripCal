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
  const response = await runtime.processor.setTripDailyAllowances({
    tripCreatedId: String(body.tripCreatedId ?? ""),
    assignments: Array.isArray(body.assignments) ? body.assignments : [],
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

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
