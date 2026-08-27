import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, parse, resolve } from "node:path";

const PROJECT_MANIFEST = ".pixiu-project.json";
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "target",
  "dist",
  "build",
  "tmp",
  "temp",
]);

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function pathKey(value) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isDirectory(path) {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

function hasProjectMarker(root) {
  return existsSync(resolve(root, ".git")) || existsSync(resolve(root, PROJECT_MANIFEST));
}

function findNearestProjectRoot(startPath) {
  const original = resolve(requiredText(startPath, "workspace root"));
  let current = isDirectory(original) ? original : dirname(original);
  const volumeRoot = parse(current).root;

  while (true) {
    if (hasProjectMarker(current)) return current;
    if (pathKey(current) === pathKey(volumeRoot)) return undefined;
    const parent = dirname(current);
    if (pathKey(parent) === pathKey(current)) return undefined;
    current = parent;
  }
}

function normalizeAlias(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s._\-/\\]+/g, "");
}

function readProjectManifest(root) {
  const path = resolve(root, PROJECT_MANIFEST);
  if (!existsSync(path)) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Invalid ${PROJECT_MANIFEST} at ${path}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid ${PROJECT_MANIFEST} object at ${path}.`);
  }
  const name = typeof parsed.name === "string" && parsed.name.trim().length > 0
    ? parsed.name.trim()
    : undefined;
  const projectKey = typeof parsed.projectKey === "string" && parsed.projectKey.trim().length > 0
    ? parsed.projectKey.trim()
    : undefined;
  const aliases = Array.isArray(parsed.aliases)
    ? parsed.aliases
        .filter((alias) => typeof alias === "string" && alias.trim().length > 0)
        .map((alias) => alias.trim())
    : [];
  return { name, projectKey, aliases, path };
}

function isWithinAllowedRoot(candidate, allowedRoot) {
  const candidateKey = pathKey(candidate);
  const allowedKey = pathKey(allowedRoot);
  if (candidateKey === allowedKey) return true;
  const separator = process.platform === "win32" ? "\\" : "/";
  return candidateKey.startsWith(`${allowedKey}${separator}`);
}

function uniqueAliases(values) {
  const aliases = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    const alias = value.trim();
    const key = normalizeAlias(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

function projectCandidate(root, projectRefFromPath) {
  const canonicalRoot = findNearestProjectRoot(root);
  if (!canonicalRoot) {
    throw new Error(`PROJECT_CONTEXT_REQUIRED: no project marker was found for ${resolve(root)}.`);
  }
  const manifest = readProjectManifest(canonicalRoot);
  const projectName = manifest?.name ?? basename(canonicalRoot);
  const projectKey = manifest?.projectKey ?? projectName;
  const aliases = uniqueAliases([
    projectName,
    projectKey,
    basename(canonicalRoot),
    ...(manifest?.aliases ?? []),
  ]);
  return {
    projectRef: projectRefFromPath(canonicalRoot),
    workspaceRoot: canonicalRoot,
    projectName,
    projectKey,
    aliases,
    manifestPath: manifest?.path,
  };
}

function discoverProjectCandidates(allowedRoots, projectRefFromPath) {
  const candidates = new Map();
  const addCandidate = (root) => {
    if (!isDirectory(root)) return;
    try {
      const candidate = projectCandidate(root, projectRefFromPath);
      candidates.set(pathKey(candidate.workspaceRoot), candidate);
    } catch (error) {
      if (!String(error?.message ?? error).includes("PROJECT_CONTEXT_REQUIRED")) throw error;
    }
  };

  for (const configuredRoot of allowedRoots) {
    const allowedRoot = resolve(configuredRoot);
    if (!isDirectory(allowedRoot)) continue;

    if (hasProjectMarker(allowedRoot)) {
      addCandidate(allowedRoot);
      continue;
    }

    for (const entry of readdirSync(allowedRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) continue;
      addCandidate(resolve(allowedRoot, entry.name));
    }
  }

  return [...candidates.values()];
}

function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeAlias(query);
  if (!normalizedQuery) return 0;
  let best = 0;
  for (const alias of candidate.aliases) {
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) continue;
    if (normalizedAlias === normalizedQuery) best = Math.max(best, 100);
    else if (normalizedQuery.length >= 4 && normalizedAlias.startsWith(normalizedQuery)) best = Math.max(best, 85);
    else if (normalizedAlias.length >= 4 && normalizedQuery.startsWith(normalizedAlias)) best = Math.max(best, 80);
    else if (normalizedAlias.length >= 4 && normalizedQuery.includes(normalizedAlias)) best = Math.max(best, 70);
    else if (normalizedQuery.length >= 4 && normalizedAlias.includes(normalizedQuery)) best = Math.max(best, 60);
  }
  return best;
}

export function createDevSpaceProjectResolver(workspaces, options = {}) {
  if (!workspaces || typeof workspaces.getWorkspace !== "function") {
    throw new Error("DevSpace project resolver requires a workspace registry.");
  }
  if (typeof options.projectRefFromPath !== "function") {
    throw new Error("DevSpace project resolver requires projectRefFromPath.");
  }
  const allowedRoots = Array.isArray(options.allowedRoots)
    ? options.allowedRoots.filter((root) => typeof root === "string" && root.trim().length > 0)
    : [];

  return {
    resolveWorkspaceId(workspaceId) {
      const workspace = workspaces.getWorkspace(workspaceId);
      if (!workspace || typeof workspace.root !== "string" || workspace.root.trim().length === 0) {
        throw new Error(`DevSpace workspace has no valid root: ${workspaceId}`);
      }
      const candidate = projectCandidate(workspace.root, options.projectRefFromPath);
      return {
        ...candidate,
        resolution: "CURRENT_WORKSPACE_PROJECT",
        executionBindingAuthoritative: true,
        changesExecutionBinding: false,
      };
    },

    resolveProjectQuery(query) {
      const requested = requiredText(query, "project query");

      if (isAbsolute(requested) && isDirectory(requested)) {
        const canonicalRoot = findNearestProjectRoot(requested);
        if (!canonicalRoot) {
          throw new Error(`PROJECT_CONTEXT_REQUIRED: no project marker was found for ${requested}.`);
        }
        if (allowedRoots.length > 0 && !allowedRoots.some((root) => isWithinAllowedRoot(canonicalRoot, root))) {
          throw new Error(`Project path is outside DevSpace allowed roots: ${canonicalRoot}`);
        }
        return {
          ...projectCandidate(canonicalRoot, options.projectRefFromPath),
          resolution: "EXPLICIT_PROJECT_PATH",
          lookupMode: "READ_ONLY_PROJECT_LOOKUP",
          changesExecutionBinding: false,
          matchedQuery: requested,
        };
      }

      if (allowedRoots.length === 0) {
        throw new Error("No DevSpace allowed roots are configured for project-name resolution.");
      }

      const matches = discoverProjectCandidates(allowedRoots, options.projectRefFromPath)
        .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, requested) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.projectName.localeCompare(right.projectName));

      if (matches.length === 0) {
        throw new Error(`PROJECT_CONTEXT_REQUIRED: no project matched query: ${requested}`);
      }
      const bestScore = matches[0].score;
      const bestMatches = matches.filter((candidate) => candidate.score === bestScore);
      if (bestMatches.length !== 1) {
        const candidates = bestMatches
          .map((candidate) => `${candidate.projectName} (${candidate.workspaceRoot})`)
          .join(", ");
        throw new Error(`PROJECT_CONTEXT_AMBIGUOUS: project query "${requested}" matched: ${candidates}`);
      }

      const { score: _score, ...match } = bestMatches[0];
      return {
        ...match,
        resolution: "EXPLICIT_PROJECT_QUERY",
        lookupMode: "READ_ONLY_PROJECT_LOOKUP",
        changesExecutionBinding: false,
        matchedQuery: requested,
      };
    },
  };
}
