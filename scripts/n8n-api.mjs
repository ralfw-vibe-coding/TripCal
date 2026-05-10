#!/usr/bin/env node
import fs from "node:fs";

const WORKFLOW_NAME = "TripCal - Email Ingest";
const WORKFLOW_TEMPLATE_PATH = "n8n-workflows/tripcal-email-ingest.json";
const DEFAULT_TRIPCAL_EMAIL_INGEST_URL = "https://ralfw-tripcal.netlify.app/api/ingest-email";

const env = readEnv(".env");
const apiUrl = requiredEnv("N8N_API_URL").replace(/\/$/, "");
const apiKey = requiredEnv("N8N_API_KEY");

const command = process.argv[2] ?? "check-tripcal-email-ingest";

if (command === "check-tripcal-email-ingest") {
  const workflow = await loadTripCalWorkflow();
  printWorkflowStatus(workflow);
} else if (command === "sync-tripcal-email-ingest") {
  const dryRun = process.argv.includes("--dry-run");
  const workflow = await loadTripCalWorkflow();
  const updated = buildUpdatedWorkflow(workflow);
  printWorkflowStatus(updated);
  if (dryRun) {
    console.log("dryRun=true; workflow was not updated");
  } else {
    await updateWorkflow(updated);
    console.log(`updated workflow ${updated.id} (${updated.name})`);
  }
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Usage: node scripts/n8n-api.mjs [check-tripcal-email-ingest|sync-tripcal-email-ingest [--dry-run]]");
  process.exit(1);
}

async function loadTripCalWorkflow() {
  const search = await n8n(`/workflows?name=${encodeURIComponent(WORKFLOW_NAME)}&limit=20`);
  const workflowRef = search.data?.find((workflow) => workflow.name === WORKFLOW_NAME);
  if (!workflowRef) {
    throw new Error(`Workflow not found: ${WORKFLOW_NAME}`);
  }
  return n8n(`/workflows/${workflowRef.id}`);
}

function buildUpdatedWorkflow(workflow) {
  const template = JSON.parse(fs.readFileSync(WORKFLOW_TEMPLATE_PATH, "utf8"));
  const next = structuredClone(workflow);
  const templateNodesByName = new Map(template.nodes.map((node) => [node.name, node]));

  for (const node of next.nodes) {
    const templateNode = templateNodesByName.get(node.name);
    if (!templateNode) continue;

    node.parameters = structuredClone(templateNode.parameters);
    if (templateNode.notes !== undefined) node.notes = templateNode.notes;
    if (templateNode.notesInFlow !== undefined) node.notesInFlow = templateNode.notesInFlow;
  }

  const config = findNode(next, "TripCal Config");
  config.parameters.jsCode = config.parameters.jsCode
    .replace(DEFAULT_TRIPCAL_EMAIL_INGEST_URL, requiredEnv("TRIPCAL_EMAIL_INGEST_URL", false) ?? DEFAULT_TRIPCAL_EMAIL_INGEST_URL)
    .replace("REPLACE_WITH_EMAIL_INGEST_TOKEN", "c423b7d9-70d0-43c1-831e-7d6fd843e1b1");

  return next;
}

function printWorkflowStatus(workflow) {
  const emailTrigger = findNode(workflow, "Email Trigger");
  const config = findNode(workflow, "TripCal Config");
  const send = findNode(workflow, "Send to TripCal");
  const error = findNode(workflow, "Build TripCal Error");

  console.log(JSON.stringify(
    {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      emailTrigger: {
        postProcessAction: emailTrigger.parameters.postProcessAction,
        downloadAttachments: emailTrigger.parameters.downloadAttachments,
        format: emailTrigger.parameters.format,
        imapCredential: emailTrigger.credentials?.imap?.name,
      },
      config: {
        hasNote: Boolean(config.notesInFlow && config.notes),
        urlConfigured: config.parameters.jsCode.includes(DEFAULT_TRIPCAL_EMAIL_INGEST_URL),
        tokenConfigured: config.parameters.jsCode.includes("c423b7d9-70d0-43c1-831e-7d6fd843e1b1"),
      },
      sendToTripCal: {
        bodyMode: send.parameters.specifyBody,
        hasJsonContentTypeHeader: JSON.stringify(send.parameters.headerParameters ?? {}).includes("Content-Type"),
        sendsJsonPayload: typeof send.parameters.jsonBody === "string" && send.parameters.jsonBody.includes("$json.payload"),
        usesMultipart: send.parameters.contentType === "multipart-form-data",
      },
      errorHandling: {
        checksAllItems: error.parameters.jsCode.includes("$input.all()") && error.parameters.jsCode.includes("for (let index = 0;"),
      },
    },
    null,
    2,
  ));
}

function findNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  return node;
}

async function updateWorkflow(workflow) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings?.executionOrder ? { executionOrder: workflow.settings.executionOrder } : {},
    staticData: workflow.staticData ?? null,
  };
  return n8n(`/workflows/${workflow.id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function n8n(path, options = {}) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...options,
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`n8n API ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function requiredEnv(name, required = true) {
  const value = env[name]?.trim();
  if (!value && required) throw new Error(`Missing env var: ${name}`);
  return value;
}

function readEnv(path) {
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index < 0) return [line.trim(), ""];
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}
