import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const children = new Set();

function log(name, message) {
  for (const line of String(message).split(/\r?\n/)) {
    if (line.trim()) {
      console.log(`[${name}] ${line}`);
    }
  }
}

function startProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: {
      ...process.env,
      ...options.env,
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.add(child);

  child.stdout.on("data", (chunk) => log(name, chunk));
  child.stderr.on("data", (chunk) => log(name, chunk));

  child.on("exit", (code, signal) => {
    children.delete(child);
    log(name, `stopped code=${code ?? "-"} signal=${signal ?? "-"}`);
  });

  return child;
}

async function main() {
  console.log("AI Agent Office starting...");
  console.log("Tek komut modu: dashboard + Telegram bot + tek proje onizleme");

  startProcess("dashboard", "node", ["src/dashboard.js"], {
    env: {
      DASHBOARD_PORT: process.env.DASHBOARD_PORT ?? "4100",
    },
  });

  startProcess("repo-sync", "node", ["src/repoSync.js"]);

  startProcess("agent-runner", "node", ["src/agentRunner.js"]);

  startProcess("preview", "node", ["src/preview.js"], {
    env: {
      PREVIEW_PORT: process.env.PREVIEW_PORT ?? "3000",
    },
  });

  if (existsSync(join(root, ".env"))) {
    startProcess("bot", "node", ["src/index.js"]);
  } else {
    console.log("[bot] .env bulunamadi, Telegram bot baslatilmadi.");
  }

  console.log("Hazir. Dashboard adresini terminaldeki [dashboard] satirindan ac.");
  console.log("Tek proje onizleme adresini terminaldeki [preview] satirindan ac.");
  console.log("Kapatmak icin bu terminalde Ctrl+C kullan.");
}

function shutdown() {
  console.log("AI Agent Office kapatiliyor...");
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exitCode = 1;
});
