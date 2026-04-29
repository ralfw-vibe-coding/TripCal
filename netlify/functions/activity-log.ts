import { getProcessorRuntime } from "../../src/runtime/singleton";
import { readActivityLog } from "../../src/runtime/readActivityLog";

type NetlifyEvent = {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const runtime = await getProcessorRuntime();
  const limit = Number(event.queryStringParameters?.limit ?? 100);
  return json(200, await readActivityLog(runtime, Number.isFinite(limit) ? limit : 100));
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body, null, 2),
  };
}
