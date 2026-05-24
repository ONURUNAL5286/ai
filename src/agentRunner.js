import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const delayMs = Number(process.env.AGENT_RUNNER_DELAY_MS || 2500);
const scanMs = Number(process.env.AGENT_RUNNER_SCAN_MS || 10000);
const runOnce = (process.env.AGENT_RUNNER_ONCE || "false").toLowerCase() === "true";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function parseBoard(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];

  lines.forEach((line, lineIndex) => {
    if (!line.startsWith("|") || line.includes("---") || line.includes("Agent | Status")) {
      return;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/g, ""));

    if (cells.length < 5 || cells[0] === "#") {
      return;
    }

    tasks.push({
      lineIndex,
      index: cells[0],
      agent: cells[1],
      status: cells[2],
      task: cells[3],
      output: cells[4],
    });
  });

  return { lines, tasks };
}

function boardLine(task, status) {
  return `| ${task.index} | ${task.agent} | ${status} | ${task.task} | \`${task.output}\` |`;
}

async function writeBoard(projectPath, parsed, task, status) {
  parsed.lines[task.lineIndex] = boardLine(task, status);
  await writeFile(join(projectPath, "AGENT_BOARD.md"), `${parsed.lines.join("\n").trim()}\n`, "utf8");
}

function projectTitle(readme, fallback) {
  const heading = readme.split(/\r?\n/).find((line) => line.startsWith("# "));
  return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

function listTasksByAgent(tasks, agent) {
  return tasks.filter((task) => task.agent === agent).map((task) => task.task);
}

function kobiAppHtml(title, tasks) {
  const featureItems = listTasksByAgent(tasks, "Frontend/Backend Agent");
  const qaItems = listTasksByAgent(tasks, "Product/QA Agent");
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17202a; background: #f4f6f8; }
      body { margin: 0; }
      header { background: #17212e; color: #fff; padding: 24px; }
      header h1 { margin: 0 0 6px; font-size: 28px; }
      header p { margin: 0; color: #c5ced8; }
      main { max-width: 1180px; margin: 0 auto; padding: 20px; }
      .metrics, .grid { display: grid; gap: 12px; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 16px; }
      .grid { grid-template-columns: 1.1fr .9fr; }
      section, .metric { background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 16px; }
      .metric strong { display: block; font-size: 25px; }
      .metric span, th { color: #667487; font-size: 13px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      label { display: grid; gap: 5px; margin-bottom: 10px; font-size: 13px; color: #526071; }
      input, select { border: 1px solid #cad3dd; border-radius: 6px; padding: 9px 10px; font: inherit; }
      button { border: 0; border-radius: 6px; background: #176b52; color: #fff; padding: 10px 13px; font-weight: 700; cursor: pointer; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-top: 1px solid #e5eaf0; padding: 10px; text-align: left; }
      .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; background: #eef2f6; }
      .late { color: #a13d13; background: #fff1e8; }
      .ok { color: #146c3b; background: #dff5e8; }
      .features { margin-top: 16px; }
      .features ul { columns: 2; padding-left: 20px; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .features ul { columns: 1; } }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Musteri, teklif ve tahsilat surecini tek ekrandan yoneten calisan demo uygulama.</p>
    </header>
    <main>
      <div class="metrics">
        <div class="metric"><strong id="totalOffers">0</strong><span>Toplam teklif</span></div>
        <div class="metric"><strong id="acceptRate">0%</strong><span>Kabul orani</span></div>
        <div class="metric"><strong id="pendingCash">0 TL</strong><span>Bekleyen tahsilat</span></div>
        <div class="metric"><strong id="lateCash">0 TL</strong><span>Geciken odeme</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Yeni Teklif</h2>
          <label>Musteri <input id="customer" value="Akdeniz Klima Ltd." /></label>
          <label>Iletisim notu <input id="note" value="Bakim sozlesmesi icin teklif bekliyor" /></label>
          <label>Kalem <input id="item" value="Yillik servis paketi" /></label>
          <label>Tutar <input id="amount" type="number" value="42000" /></label>
          <label>Durum
            <select id="status">
              <option>Taslak</option>
              <option>Gonderildi</option>
              <option selected>Kabul Edildi</option>
              <option>Reddedildi</option>
            </select>
          </label>
          <button id="addOffer">Teklifi Kaydet</button>
        </section>
        <section>
          <h2>Arama ve Filtre</h2>
          <label>Arama <input id="search" placeholder="Musteri veya kalem ara" /></label>
          <label>Durum
            <select id="filter">
              <option value="">Tum durumlar</option>
              <option>Taslak</option>
              <option>Gonderildi</option>
              <option>Kabul Edildi</option>
              <option>Reddedildi</option>
            </select>
          </label>
        </section>
      </div>
      <section style="margin-top:16px">
        <h2>Teklif ve Tahsilat Listesi</h2>
        <table>
          <thead><tr><th>Musteri</th><th>Kalem</th><th>Tutar</th><th>Durum</th><th>Tahsilat</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </section>
      <section class="features">
        <h2>Tamamlanan Sprint Maddeleri</h2>
        <ul>
          ${featureItems.concat(qaItems).map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ")}
        </ul>
      </section>
    </main>
    <script>
      const offers = [
        { customer: "Akdeniz Klima Ltd.", note: "Bakim sozlesmesi", item: "Yillik servis paketi", amount: 42000, status: "Kabul Edildi", paid: false, late: true },
        { customer: "Mavi Ofis", note: "Yeni sube", item: "Kurulum ve destek", amount: 28500, status: "Gonderildi", paid: false, late: false },
        { customer: "Delta Gida", note: "Aylik takip", item: "Danismanlik", amount: 18000, status: "Kabul Edildi", paid: true, late: false }
      ];
      const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
      function render() {
        const q = document.getElementById("search").value.toLowerCase();
        const filter = document.getElementById("filter").value;
        const filtered = offers.filter((offer) => (!filter || offer.status === filter) && (offer.customer.toLowerCase().includes(q) || offer.item.toLowerCase().includes(q)));
        document.getElementById("rows").innerHTML = filtered.map((offer) => {
          const cash = offer.status === "Kabul Edildi" ? (offer.paid ? "<span class='pill ok'>Tahsil edildi</span>" : "<span class='pill late'>" + (offer.late ? "Gecikti" : "Bekliyor") + "</span>") : "-";
          return "<tr><td>" + offer.customer + "<br><small>" + offer.note + "</small></td><td>" + offer.item + "</td><td>" + money.format(offer.amount) + "</td><td><span class='pill'>" + offer.status + "</span></td><td>" + cash + "</td></tr>";
        }).join("");
        const accepted = offers.filter((offer) => offer.status === "Kabul Edildi");
        const pending = accepted.filter((offer) => !offer.paid).reduce((sum, offer) => sum + offer.amount, 0);
        const late = accepted.filter((offer) => !offer.paid && offer.late).reduce((sum, offer) => sum + offer.amount, 0);
        document.getElementById("totalOffers").textContent = offers.length;
        document.getElementById("acceptRate").textContent = Math.round((accepted.length / offers.length) * 100) + "%";
        document.getElementById("pendingCash").textContent = money.format(pending);
        document.getElementById("lateCash").textContent = money.format(late);
      }
      document.getElementById("addOffer").addEventListener("click", () => {
        offers.unshift({
          customer: document.getElementById("customer").value,
          note: document.getElementById("note").value,
          item: document.getElementById("item").value,
          amount: Number(document.getElementById("amount").value || 0),
          status: document.getElementById("status").value,
          paid: false,
          late: false
        });
        render();
      });
      document.getElementById("search").addEventListener("input", render);
      document.getElementById("filter").addEventListener("change", render);
      render();
    </script>
  </body>
</html>
`;
}

function genericAppHtml(title, tasks) {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18202a; background: #f5f7fa; }
      body { margin: 0; }
      header { padding: 24px; background: #1d2733; color: white; }
      main { max-width: 1040px; margin: 0 auto; padding: 20px; }
      section { background: white; border: 1px solid #dce3eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
      li { margin: 8px 0; }
      .done { color: #176b52; font-weight: 700; }
    </style>
  </head>
  <body>
    <header><h1>${escapeHtml(title)}</h1><p>AI Agent Office tarafindan uretilen calisan proje taslagi.</p></header>
    <main>
      <section><h2>Uygulama Modulleri</h2><ul>${tasks.map((task) => `<li><span class="done">DONE</span> ${escapeHtml(task.task)}</li>`).join("")}</ul></section>
    </main>
  </body>
</html>
`;
}

async function updateReadme(projectPath, title, task) {
  const readmePath = join(projectPath, "README.md");
  const readme = await readText(readmePath);
  const block = `\n## Agent Teslim Notlari\n\n- ${task.agent}: ${task.task} tamamlandi.\n- Calistirma: \`start.cmd\`\n- Ana ekran: \`public/index.html\`\n`;
  if (!readme.includes("## Agent Teslim Notlari")) {
    await writeFile(readmePath, `${readme.trim()}\n${block}`, "utf8");
    return;
  }

  if (!readme.includes(task.task)) {
    await writeFile(readmePath, `${readme.trim()}\n- ${task.agent}: ${task.task} tamamlandi.\n`, "utf8");
  }
}

async function updateStatus(projectPath, tasks) {
  const done = tasks.filter((task) => task.status === "DONE").length;
  const total = tasks.length;
  const status = done === total ? "DONE" : "IN_PROGRESS";
  const lines = [
    `# Status`,
    ``,
    `- Overall status: ${status}`,
    `- Run command: start.cmd`,
    `- Verified: Agent runner updated project files locally.`,
    ``,
    `## Progress`,
    ``,
    `- DONE: ${done}`,
    `- TOTAL: ${total}`,
    ``,
  ];

  await writeFile(join(projectPath, "STATUS.md"), lines.join("\n"), "utf8");
}

async function performTask(projectPath, projectName, parsed, task) {
  const readme = await readText(join(projectPath, "README.md"));
  const title = projectTitle(readme, projectName);
  const futureTasks = parsed.tasks.map((item) => (item.index === task.index ? { ...item, status: "DONE" } : item));

  if (task.output === "public/index.html") {
    const html = projectName.includes("kobi-teklif")
      ? kobiAppHtml(title, futureTasks)
      : genericAppHtml(title, futureTasks);
    await writeFile(join(projectPath, "public", "index.html"), html, "utf8");
  } else if (task.output === "README.md") {
    await updateReadme(projectPath, title, task);
  } else if (task.output === "STATUS.md") {
    await updateStatus(projectPath, futureTasks);
  } else if (task.output.endsWith(".md")) {
    const target = join(projectPath, task.output);
    const current = await readText(target);
    await writeFile(target, `${current.trim()}\n\n- [x] ${task.task}\n`, "utf8");
  }

  await updateStatus(projectPath, futureTasks);
}

async function processOneTask() {
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const projectPath = join(projectsRoot, entry.name);
    const boardPath = join(projectPath, "AGENT_BOARD.md");
    if (!existsSync(boardPath)) {
      continue;
    }

    const board = await readText(boardPath);
    const parsed = parseBoard(board);
    const nextTask = parsed.tasks.find((task) => task.status === "TODO");
    if (!nextTask) {
      continue;
    }

    console.log(`${entry.name}: ${nextTask.agent} basladi -> ${nextTask.task}`);
    await writeBoard(projectPath, parsed, nextTask, "IN_PROGRESS");
    await sleep(delayMs);

    const refreshed = parseBoard(await readText(boardPath));
    const activeTask = refreshed.tasks.find((task) => task.index === nextTask.index);
    if (!activeTask || activeTask.status !== "IN_PROGRESS") {
      return true;
    }

    await performTask(projectPath, entry.name, refreshed, activeTask);
    await writeBoard(projectPath, refreshed, activeTask, "DONE");
    console.log(`${entry.name}: ${activeTask.agent} tamamlandi -> ${activeTask.task}`);
    return true;
  }

  return false;
}

async function main() {
  console.log("Agent runner aktif. TODO maddeleri sirayla islenecek.");

  while (true) {
    const worked = await processOneTask();
    if (runOnce && !worked) {
      break;
    }
    await sleep(worked ? 500 : scanMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
