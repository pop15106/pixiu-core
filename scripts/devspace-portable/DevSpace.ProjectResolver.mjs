export function createDevSpaceProjectResolver(workspaces, options = {}) {
  if (!workspaces || typeof workspaces.getWorkspace !== "function") {
    throw new Error("DevSpace project resolver requires a workspace registry.");
  }
  if (typeof options.projectRefFromPath !== "function") {
    throw new Error("DevSpace project resolver requires projectRefFromPath.");
  }

  return {
    resolveWorkspaceId(workspaceId) {
      const workspace = workspaces.getWorkspace(workspaceId);
      if (!workspace || typeof workspace.root !== "string" || workspace.root.trim().length === 0) {
        throw new Error(`DevSpace workspace has no valid root: ${workspaceId}`);
      }
      return {
        projectRef: options.projectRefFromPath(workspace.root),
        workspaceRoot: workspace.root,
      };
    },
  };
}
