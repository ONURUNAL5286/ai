import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const intervalMs = Number(process.env.REPO_SYNC_INTERVAL_MS || 7000);
const runOnce = (process.env.REPO_SYNC_ONCE || "false").toLowerCase() === "true";
let syncing = false;

async function git(args) {
  const { stdout, stderr } = await execFileAsync("git", args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  return `${stdout}${stderr}`.trim();
}

async function isClean() {
  const status = await git(["status", "--porcelain"]);
  return status.length === 0;
}

async function statusEntries() {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.slice(3).trim().replace(/^"|"$/g, "").replaceAll("\\", "/"));
}

function isProjectOutput(path) {
  return path.startsWith("projects/");
}

async function saveProjectOutputIfNeeded() {
  const entries = await statusEntries();
  if (entries.length === 0) {
    return true;
  }

  if (!entries.every(isProjectOutput)) {
    console.log(`Kod degisikligi var, otomatik sync bekliyor: ${entries.join(", ")}`);
    return false;
  }

  await git(["add", "projects"]);
  const message = `Auto save agent project output ${new Date().toISOString().slice(0, 19)}`;
  const output = await git(["commit", "-m", message]);
  console.log(output || "Agent proje ciktilari kaydedildi.");
  return true;
}

async function syncOnce() {
  if (syncing) {
    return;
  }

  syncing = true;
  try {
    if (!(await saveProjectOutputIfNeeded())) {
      return;
    }

    const output = await git(["pull", "--rebase", "--strategy-option=ours"]);
    if (output.includes("Already up to date")) {
      console.log("Repo guncel.");
    } else {
      console.log(output || "Repo senkronize edildi.");
    }

    if (await isClean()) {
      await git(["push"]);
    }
  } catch (error) {
    console.log(`Repo sync hatasi: ${error.message}`);
  } finally {
    syncing = false;
  }
}

async function main() {
  console.log(`Repo sync aktif. Her ${Math.round(intervalMs / 1000)} saniyede GitHub kontrol edilecek.`);
  await syncOnce();

  if (!runOnce) {
    setInterval(syncOnce, intervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
