const fs = require("node:fs");
const path = require("node:path");

const normalizePathIdentity = (
  candidatePath,
  { platform = process.platform, pathApi = path } = {},
) => {
  const resolvedPath = pathApi.resolve(candidatePath);
  return platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
};

const isPathAtOrInside = (
  candidatePath,
  parentPath,
  { platform = process.platform, pathApi = path } = {},
) => {
  const candidate = normalizePathIdentity(candidatePath, { platform, pathApi });
  const parent = normalizePathIdentity(parentPath, { platform, pathApi });
  const relative = pathApi.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${pathApi.sep}`)
    && relative !== ".."
    && !pathApi.isAbsolute(relative));
};

const resolveThroughExistingAncestor = (
  candidatePath,
  { fsApi = fs, pathApi = path } = {},
) => {
  const resolvedCandidate = pathApi.resolve(candidatePath);
  let existingAncestor = resolvedCandidate;
  while (!fsApi.existsSync(existingAncestor)) {
    const parent = pathApi.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }

  const realAncestor = fsApi.realpathSync(existingAncestor);
  return pathApi.resolve(realAncestor, pathApi.relative(existingAncestor, resolvedCandidate));
};

module.exports = {
  isPathAtOrInside,
  normalizePathIdentity,
  resolveThroughExistingAncestor,
};
