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

async function syncOnce() {
  if (syncing) {
    return;
  }

  syncing = true;
  try {
    if (!(await isClean())) {
      console.log("Local degisiklik var, git pull atlandi.");
      return;
    }

    const output = await git(["pull", "--ff-only"]);
    if (output.includes("Already up to date")) {
      console.log("Repo guncel.");
      return;
    }

    console.log(output || "Repo senkronize edildi.");
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
