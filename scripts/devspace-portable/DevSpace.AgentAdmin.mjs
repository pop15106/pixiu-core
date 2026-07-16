import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , rawCliPath, action, agentId] = process.argv;
if (!rawCliPath || !action) {
  throw new Error("Usage: DevSpace.AgentAdmin.mjs <devspace-cli> <list|show|mark-stopped> [agent-id]");
}

if (agentId && !/^agt_[a-f0-9]{8}$/.test(agentId)) {
  throw new Error(`Invalid DevSpace Agent ID: ${agentId}`);
}

const distDirectory = dirname(resolve(rawCliPath));
const packageMetadata = JSON.parse(
  readFileSync(join(distDirectory, "..", "package.json"), "utf8"),
);
if (packageMetadata.version !== "1.0.4") {
  throw new Error(
    "The DevSpace Agent controller supports DevSpace 1.0.4 only; found " +
      packageMetadata.version +
      ".",
  );
}
const importFromDist = (fileName) => import(pathToFileURL(join(distDirectory, fileName)).href);
const [{ loadConfig }, { createLocalAgentStore }] = await Promise.all([
  importFromDist("config.js"),
  importFromDist("local-agent-store.js"),
]);

function formatAgentLine(agent) {
  return [
    agent.id,
    agent.status,
    agent.profileName,
    agent.provider,
    agent.model,
    agent.thinking ? "thinking=" + agent.thinking : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function printCliRecord(record) {
  console.log(formatAgentLine(record));
  if (record.latestResponse) {
    console.log(record.latestResponse);
  } else if (record.error) {
    console.error(record.error);
  } else if (record.status === "starting" || record.status === "running") {
    console.log("No final response yet. Call devspace agents show " + record.id + " again later.");
  }
}

const store = createLocalAgentStore(loadConfig());
try {
  if (action === "list") {
    console.log(JSON.stringify(store.list(), null, 2));
  } else if (action === "cli-list") {
    const agents = store.list({
      workspaceId: process.env.DEVSPACE_WORKSPACE_ID,
      workspaceRoot: resolve(process.cwd()),
    });
    if (agents.length === 0) {
      console.log("No subagent sessions found for this workspace.");
    } else {
      for (const agent of agents) console.log(formatAgentLine(agent));
    }
  } else if (action === "show") {
    const record = store.get(agentId);
    if (!record) throw new Error(`Unknown subagent id: ${agentId}`);
    console.log(JSON.stringify(record, null, 2));
  } else if (action === "cli-show") {
    const record = store.get(agentId);
    if (!record) throw new Error("Unknown subagent id: " + agentId);
    printCliRecord(record);
  } else if (action === "mark-stopped") {
    const record = store.get(agentId);
    if (!record) throw new Error(`Unknown subagent id: ${agentId}`);
    const stopMessage = "Stopped by the DevSpace One-Click agent controller.";
    const error =
      record.status === "stopped" && record.error?.startsWith(stopMessage)
        ? record.error
        : [
            stopMessage,
            "Previous status: " + record.status,
            record.error ? "Previous error:\n" + record.error : "",
          ]
            .filter(Boolean)
            .join("\n");
    const updated = store.update(record.id, {
      status: "stopped",
      error,
    });
    console.log(JSON.stringify(updated, null, 2));
  } else {
    throw new Error(`Unknown Agent admin action: ${action}`);
  }
} finally {
  store.close();
}
