import { fetchWithRetry } from "./network.js";

export async function createGitHubIssue({ token, repo, title, body, labels }) {
  let response;
  try {
    response = await fetchWithRetry(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ai-agent-office-bot",
      },
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
