import { config, validateConfig } from "./config.js";
import { fetchWithRetry } from "./network.js";

async function checkTelegram() {
  const response = await fetchWithRetry(
    `https://api.telegram.org/bot${config.telegramBotToken}/getMe`,
  ).catch((error) => {
    throw new Error(`Telegram network check failed: ${error.message}`);
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.ok) {
    const message = payload.description ?? response.statusText;
    throw new Error(`Telegram token check failed: ${message}`);
  }

  return payload.result;
}

async function checkGitHub() {
  if (config.dryRun) {
    return {
      skipped: true,
      reason: "DRY_RUN=true",
    };
  }

  const response = await fetchWithRetry(`https://api.github.com/repos/${config.githubRepo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-agent-office-bot",
    },
  }).catch((error) => {
    throw new Error(`GitHub network check failed: ${error.message}`);
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub repo check failed: ${response.status} ${message}`);
  }

  return payload;
}

async function checkGitHubContentsPermission() {
  if (config.dryRun) {
    return {
      skipped: true,
      reason: "DRY_RUN=true",
    };
  }

  const response = await fetchWithRetry(`https://api.github.com/repos/${config.githubRepo}/contents/README.md`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-agent-office-bot",
    },
  }).catch((error) => {
    throw new Error(`GitHub contents network check failed: ${error.message}`);
  });

  if (response.status === 404) {
    return {
      readable: true,
      note: "README.md not found, but contents endpoint is reachable",
    };
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? response.statusText;
    throw new Error(`GitHub contents check failed: ${response.status} ${message}`);
  }

  return {
    readable: true,
    note: "README.md readable",
  };
}

async function main() {
  validateConfig();

  console.log("Checking AI Agent Office config...");
  console.log(`GitHub repo: ${config.githubRepo}`);
  console.log(`Dry run: ${config.dryRun}`);
  console.log(
    `Allowed chats: ${
      config.allowedChatIds.size > 0 ? [...config.allowedChatIds].join(", ") : "all"
    }`,
  );

  const telegram = await checkTelegram();
  console.log(`Telegram bot: @${telegram.username}`);

  const github = await checkGitHub();
  if (github.skipped) {
    console.log(`GitHub check skipped: ${github.reason}`);
  } else {
    console.log(`GitHub repo found: ${github.full_name}`);
  }

  const contents = await checkGitHubContentsPermission();
  if (contents.skipped) {
    console.log(`GitHub contents check skipped: ${contents.reason}`);
  } else {
    console.log(`GitHub contents endpoint reachable: ${contents.note}`);
  }

  console.log("Doctor check passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
