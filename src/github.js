import { fetchWithRetry } from "./network.js";

function baseHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ai-agent-office-bot",
  };
}

export async function createGitHubIssue({ token, repo, title, body, labels }) {
  let response;
  try {
    response = await fetchWithRetry(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: baseHeaders(token),
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    });
  } catch (error) {
    throw new Error(
      `GitHub API network request failed: ${error.message}. ` +
        "Internet, DNS, proxy, VPN veya firewall ayarlarini kontrol et.",
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub issue could not be created: ${response.status} ${message}`);
  }

  return payload;
}

export async function createGitHubIssueComment({ token, repo, issueNumber, body }) {
  let response;
  try {
    response = await fetchWithRetry(
      `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: baseHeaders(token),
        body: JSON.stringify({ body }),
      },
    );
  } catch (error) {
    throw new Error(
      `GitHub comment network request failed: ${error.message}. ` +
        "Internet, DNS, proxy, VPN veya firewall ayarlarini kontrol et.",
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub comment could not be created: ${response.status} ${message}`);
  }

  return payload;
}

async function getGitHubFile({ token, repo, path }) {
  const response = await fetchWithRetry(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
    {
      headers: baseHeaders(token),
    },
  );

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub file could not be read: ${response.status} ${message}`);
  }

  return payload;
}

export async function upsertGitHubFile({ token, repo, path, content, message }) {
  let existingFile;
  try {
    existingFile = await getGitHubFile({ token, repo, path });
  } catch (error) {
    throw new Error(
      `GitHub content read failed for ${path}: ${error.message}. ` +
        "Token icin Contents: Read and write yetkisini kontrol et.",
    );
  }

  let response;
  try {
    response = await fetchWithRetry(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
      {
        method: "PUT",
        headers: baseHeaders(token),
        body: JSON.stringify({
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          sha: existingFile?.sha,
        }),
      },
    );
  } catch (error) {
    throw new Error(
      `GitHub content write failed for ${path}: ${error.message}. ` +
        "Token icin Contents: Read and write yetkisini kontrol et.",
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messageText = payload.message ?? response.statusText;
    throw new Error(
      `GitHub file could not be written: ${response.status} ${messageText}. ` +
        "Token icin Contents: Read and write yetkisini kontrol et.",
    );
  }

  return payload;
}

export async function upsertGitHubFiles({ token, repo, files, message }) {
  const results = [];

  for (const file of files) {
    const result = await upsertGitHubFile({
      token,
      repo,
      path: file.path,
      content: file.content,
      message,
    });
    results.push(result);
  }

  return results;
}
