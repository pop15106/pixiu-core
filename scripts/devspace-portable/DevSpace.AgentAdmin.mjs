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

const store = createLocalAgentStore(loadConfig());
try {
  if (action === "list") {
    console.log(JSON.stringify(store.list(), null, 2));
  } else if (action === "show") {
    const record = store.get(agentId);
    if (!record) throw new Error(`Unknown subagent id: ${agentId}`);
    console.log(JSON.stringify(record, null, 2));
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
