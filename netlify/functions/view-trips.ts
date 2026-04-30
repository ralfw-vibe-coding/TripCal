import { getProcessorRuntime } from "../../src/runtime/singleton";

type NetlifyEvent = {
  httpMethod: string;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const runtime = await getProcessorRuntime();
  return json(200, await runtime.processor.viewTrips({}));
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
