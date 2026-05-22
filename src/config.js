import { existsSync, readFileSync } from "node:fs";

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseAllowedChatIds(value) {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

loadDotEnv();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubRepo: process.env.GITHUB_REPO ?? "ONURUNAL5286/ai",
  allowedChatIds: parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS),
  dryRun: (process.env.DRY_RUN ?? "false").toLowerCase() === "true",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2500),
};

export function validateConfig() {
  const missing = [];

  if (!config.telegramBotToken) {
    missing.push("TELEGRAM_BOT_TOKEN");
  }

  if (!config.githubToken && !config.dryRun) {
    missing.push("GITHUB_TOKEN");
  }

  if (!config.githubRepo) {
    missing.push("GITHUB_REPO");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
