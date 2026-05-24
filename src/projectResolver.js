import { listGitHubDirectory } from "./github.js";
import { slugify } from "./projectBuilder.js";

function tokens(value) {
  return new Set(
    slugify(value)
      .split("-")
      .filter((token) => token.length >= 3),
  );
}

function similarityScore(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

export async function resolveProjectSlug({ token, repo, sprint }) {
  const explicitSlug = slugify(sprint.projectSlug || sprint.existingProject);
  if (explicitSlug) {
    return {
      projectSlug: explicitSlug,
      matchType: "explicit",
    };
  }

  const desiredSlug = slugify(sprint.projectName);
  const projects = await listGitHubDirectory({ token, repo, path: "projects" });
  const projectDirs = projects.filter((item) => item.type === "dir").map((item) => item.name);

  if (projectDirs.includes(desiredSlug)) {
    return {
      projectSlug: desiredSlug,
      matchType: "exact",
    };
  }

  let bestMatch = null;
  for (const projectDir of projectDirs) {
    const score = similarityScore(desiredSlug, projectDir);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        projectSlug: projectDir,
        score,
      };
    }
  }

  if (bestMatch && bestMatch.score >= 0.5) {
    return {
      projectSlug: bestMatch.projectSlug,
      matchType: "similar",
      score: bestMatch.score,
    };
  }

  return {
    projectSlug: desiredSlug,
    matchType: "new",
  };
}
