function describeNetworkError(error) {
  const cause = error.cause;
  const details = [
    error.message,
    cause?.code,
    cause?.syscall,
    cause?.hostname,
  ].filter(Boolean);

  return details.join(" | ");
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `GitHub API network request failed: ${describeNetworkError(lastError)}. ` +
      "Internet, DNS, proxy, VPN veya firewall ayarlarini kontrol et.",
  );
}

export async function createGitHubIssue({ token, repo, title, body, labels }) {
  const response = await fetchWithRetry(`https://api.github.com/repos/${repo}/issues`, {
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

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub issue could not be created: ${response.status} ${message}`);
  }

  return payload;
}
