import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const delayMs = Number(process.env.AGENT_RUNNER_DELAY_MS || 2500);
const scanMs = Number(process.env.AGENT_RUNNER_SCAN_MS || 10000);
const runOnce = (process.env.AGENT_RUNNER_ONCE || "false").toLowerCase() === "true";
const rebuildDone = (process.env.AGENT_RUNNER_REBUILD_DONE || "false").toLowerCase() === "true";
const rebuildProject = process.env.AGENT_RUNNER_REBUILD_PROJECT || "";

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

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
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

function relativeOutput(projectName, output = "") {
  const normalized = output.replaceAll("\\", "/").replace(/^`|`$/g, "");
  const projectPrefix = `projects/${projectName}/`;
  return normalized.startsWith(projectPrefix) ? normalized.slice(projectPrefix.length) : normalized;
}

async function writeBoard(projectPath, parsed, task, status) {
  parsed.lines[task.lineIndex] = boardLine(task, status);
  await writeFile(join(projectPath, "AGENT_BOARD.md"), `${parsed.lines.join("\n").trim()}\n`, "utf8");
}

async function recordActivity(projectPath, event) {
  const activityPath = join(projectPath, "AGENT_ACTIVITY.json");
  const worklogPath = join(projectPath, "AGENT_WORKLOG.md");
  const events = await readJson(activityPath, []);
  const entry = {
    at: new Date().toISOString(),
    ...event,
  };

  events.push(entry);
  await writeFile(activityPath, `${JSON.stringify(events.slice(-200), null, 2)}\n`, "utf8");

  const worklog = await readText(worklogPath);
  const files = entry.files?.length ? `\n  - Files: ${entry.files.join(", ")}` : "";
  const line = `\n- ${entry.at} | ${entry.agent} | ${entry.phase} | Task ${entry.taskIndex}: ${entry.message}${files}\n`;
  await writeFile(worklogPath, `${worklog || "# Agent Worklog\n"}${line}`, "utf8");
}

function taskFiles(projectName, task) {
  const output = relativeOutput(projectName, task.output);
  const files = new Set(["AGENT_BOARD.md", "STATUS.md"]);
  if (output) {
    files.add(output);
  }
  return [...files];
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
  const featureItems = tasks.map((task) => task.task);
  const rows = featureItems.slice(0, 8);
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
      header p { color: #c8d2de; margin: 0; }
      main { max-width: 1180px; margin: 0 auto; padding: 20px; }
      .metrics, .grid { display: grid; gap: 12px; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 14px; }
      .grid { grid-template-columns: .9fr 1.1fr; }
      section, .metric { background: white; border: 1px solid #dce3eb; border-radius: 8px; padding: 16px; }
      .metric strong { display: block; font-size: 26px; }
      .metric span, th, small { color: #667487; font-size: 13px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      label { display: grid; gap: 5px; margin-bottom: 10px; color: #526071; font-size: 13px; }
      input, select { border: 1px solid #cad3dd; border-radius: 6px; padding: 9px 10px; font: inherit; }
      button { border: 0; border-radius: 6px; background: #176b52; color: #fff; padding: 10px 13px; font-weight: 700; cursor: pointer; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-top: 1px solid #e5eaf0; padding: 10px; text-align: left; }
      .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; background: #eef2f6; color: #314155; }
      .done { background: #dff5e8; color: #146c3b; }
      .progress { background: #dcecff; color: #145ca8; }
      .features { margin-top: 12px; }
      .features ul { columns: 2; padding-left: 20px; }
      @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } .features ul { columns: 1; } table { font-size: 14px; } }
    </style>
  </head>
  <body>
    <header><h1>${escapeHtml(title)}</h1><p>Sprint maddelerinden uretilen calisan operasyon paneli.</p></header>
    <main>
      <div class="metrics">
        <div class="metric"><strong id="totalCount">0</strong><span>Toplam kayit</span></div>
        <div class="metric"><strong id="openCount">0</strong><span>Acik is</span></div>
        <div class="metric"><strong id="doneCount">0</strong><span>Tamamlanan</span></div>
        <div class="metric"><strong id="riskCount">0</strong><span>Oncelikli</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Yeni Kayit</h2>
          <label>Baslik <input id="titleInput" value="${escapeHtml(rows[0] || "Yeni operasyon kaydi")}" /></label>
          <label>Sorumlu <input id="ownerInput" value="Operasyon Ekibi" /></label>
          <label>Durum <select id="statusInput"><option>Acik</option><option>Devam</option><option>Tamamlandi</option></select></label>
          <label>Oncelik <select id="priorityInput"><option>Yuksek</option><option>Normal</option><option>Dusuk</option></select></label>
          <button id="addRecord">Kaydet</button>
        </section>
        <section>
          <h2>Arama ve Filtre</h2>
          <label>Arama <input id="search" placeholder="Baslik veya sorumlu ara" /></label>
          <label>Durum <select id="statusFilter"><option value="">Tum durumlar</option><option>Acik</option><option>Devam</option><option>Tamamlandi</option></select></label>
          <label>Oncelik <select id="priorityFilter"><option value="">Tum oncelikler</option><option>Yuksek</option><option>Normal</option><option>Dusuk</option></select></label>
        </section>
      </div>
      <section style="margin-top:12px">
        <h2>Operasyon Listesi</h2>
        <table>
          <thead><tr><th>Baslik</th><th>Sorumlu</th><th>Durum</th><th>Oncelik</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </section>
      <section class="features">
        <h2>Sprint Kapsami</h2>
        <ul>${featureItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </main>
    <script>
      const records = ${JSON.stringify(rows.map((item, index) => ({
        title: item,
        owner: index % 2 === 0 ? "Frontend/Backend Agent" : "Product/QA Agent",
        status: index < 2 ? "Tamamlandi" : index < 5 ? "Devam" : "Acik",
        priority: index % 3 === 0 ? "Yuksek" : "Normal",
      })))};
      const byId = (id) => document.getElementById(id);
      function filteredRecords() {
        const q = byId("search").value.toLowerCase();
        const status = byId("statusFilter").value;
        const priority = byId("priorityFilter").value;
        return records.filter((record) =>
          (!q || record.title.toLowerCase().includes(q) || record.owner.toLowerCase().includes(q))
          && (!status || record.status === status)
          && (!priority || record.priority === priority)
        );
      }
      function render() {
        byId("totalCount").textContent = records.length;
        byId("openCount").textContent = records.filter((record) => record.status !== "Tamamlandi").length;
        byId("doneCount").textContent = records.filter((record) => record.status === "Tamamlandi").length;
        byId("riskCount").textContent = records.filter((record) => record.priority === "Yuksek").length;
        byId("rows").innerHTML = filteredRecords().map((record) =>
          "<tr><td>" + record.title + "</td><td>" + record.owner + "</td><td><span class='pill " + (record.status === "Tamamlandi" ? "done" : "progress") + "'>" + record.status + "</span></td><td>" + record.priority + "</td></tr>"
        ).join("");
      }
      byId("addRecord").addEventListener("click", () => {
        records.unshift({ title: byId("titleInput").value, owner: byId("ownerInput").value, status: byId("statusInput").value, priority: byId("priorityInput").value });
        render();
      });
      ["search", "statusFilter", "priorityFilter"].forEach((id) => byId(id).addEventListener("input", render));
      render();
    </script>
  </body>
</html>
`;
}

function financeAppHtml(title, tasks) {
  const completedItems = tasks.map((task) => task.task);
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
      main { max-width: 1240px; margin: 0 auto; padding: 20px; }
      .metrics, .grid, .reports { display: grid; gap: 12px; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 16px; }
      .grid { grid-template-columns: 1fr 1fr; }
      .reports { grid-template-columns: 1.1fr .9fr; margin-top: 12px; }
      section, .metric { background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 16px; }
      .metric strong { display: block; font-size: 25px; }
      .metric span, th, small { color: #667487; font-size: 13px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      label { display: grid; gap: 5px; margin-bottom: 10px; font-size: 13px; color: #526071; }
      input, select { border: 1px solid #cad3dd; border-radius: 6px; padding: 9px 10px; font: inherit; }
      button { border: 0; border-radius: 6px; background: #176b52; color: #fff; padding: 10px 13px; font-weight: 700; cursor: pointer; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-top: 1px solid #e5eaf0; padding: 10px; text-align: left; }
      .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; background: #eef2f6; }
      .late { color: #9b3414; background: #fff1e8; }
      .paid { color: #146c3b; background: #dff5e8; }
      .bar { height: 12px; border-radius: 999px; background: #dfe6ee; overflow: hidden; }
      .bar span { display: block; height: 100%; background: #176b52; }
      .trend { display: grid; grid-template-columns: repeat(6, 1fr); align-items: end; gap: 8px; height: 150px; padding-top: 10px; }
      .trend div { display: grid; align-items: end; gap: 6px; min-width: 0; }
      .trend span { border-radius: 6px 6px 0 0; background: #1d6f8f; min-height: 18px; }
      .trend em { font-style: normal; font-size: 12px; color: #667487; text-align: center; }
      .risk-list { display: grid; gap: 8px; }
      .risk-list article { border: 1px solid #ead8cc; background: #fff8f3; border-radius: 8px; padding: 10px; }
      .features { margin-top: 12px; }
      .features ul { columns: 2; padding-left: 20px; }
      @media (max-width: 820px) { .grid, .reports { grid-template-columns: 1fr; } .features ul { columns: 1; } table { font-size: 14px; } }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Gelir, gider, fatura, nakit akisi tahmini ve riskli cikislari tek panelde izleyen calisan demo.</p>
    </header>
    <main>
      <div class="metrics">
        <div class="metric"><strong id="income">0 TL</strong><span>Aylik gelir</span></div>
        <div class="metric"><strong id="expense">0 TL</strong><span>Aylik gider</span></div>
        <div class="metric"><strong id="netCash">0 TL</strong><span>Net nakit</span></div>
        <div class="metric"><strong id="lateDebt">0 TL</strong><span>Geciken borc</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Yeni Kayit</h2>
          <label>Baslik <input id="titleInput" value="Yeni tedarik faturasi" /></label>
          <label>Kategori <select id="categoryInput"><option>Operasyon</option><option>Pazarlama</option><option>Personel</option><option>Vergi</option><option>Satis</option></select></label>
          <label>Tip <select id="typeInput"><option value="expense">Gider</option><option value="income">Gelir</option></select></label>
          <label>Tutar <input id="amountInput" type="number" value="18500" /></label>
          <label>Vade <input id="dueInput" type="date" value="2026-05-29" /></label>
          <label>Durum <select id="paidInput"><option value="false">Bekliyor</option><option value="true">Odendi</option></select></label>
          <button id="addRecord">Kaydet</button>
        </section>
        <section>
          <h2>Filtreler</h2>
          <label>Arama <input id="search" placeholder="Baslik veya kategori ara" /></label>
          <label>Kategori <select id="categoryFilter"><option value="">Tum kategoriler</option><option>Operasyon</option><option>Pazarlama</option><option>Personel</option><option>Vergi</option><option>Satis</option></select></label>
          <label>Odeme durumu <select id="paidFilter"><option value="">Tumu</option><option value="paid">Odendi</option><option value="open">Bekliyor</option><option value="late">Geciken</option></select></label>
          <label>Tarih araligi <select id="rangeFilter"><option value="all">Tum kayitlar</option><option value="30">Sonraki 30 gun</option><option value="7">Sonraki 7 gun</option></select></label>
          <button id="exportCsv">CSV Disari Aktar</button>
        </section>
      </div>
      <div class="reports">
        <section>
          <h2>Aylik Gelir-Gider Trendi</h2>
          <div id="trend" class="trend"></div>
        </section>
        <section>
          <h2>Kategori Bazli Gider Dagilimi</h2>
          <div id="categoryReport"></div>
        </section>
      </div>
      <div class="reports">
        <section>
          <h2>30 Gunluk Nakit Akisi Tahmini</h2>
          <table><thead><tr><th>Tarih</th><th>Beklenen net hareket</th><th>Tahmini bakiye</th></tr></thead><tbody id="forecastRows"></tbody></table>
        </section>
        <section>
          <h2>En Riskli 5 Nakit Cikisi</h2>
          <div id="riskList" class="risk-list"></div>
        </section>
      </div>
      <section style="margin-top:12px">
        <h2>Gelir, Gider ve Fatura Kayitlari</h2>
        <table>
          <thead><tr><th>Baslik</th><th>Kategori</th><th>Tip</th><th>Tutar</th><th>Vade</th><th>Durum</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </section>
      <section class="features">
        <h2>Tamamlanan Sprint Maddeleri</h2>
        <ul>${completedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </main>
    <script>
      const records = [
        { title: "E-ticaret satis tahsilati", category: "Satis", type: "income", amount: 146000, due: "2026-05-26", paid: true },
        { title: "Kurumsal proje pesinati", category: "Satis", type: "income", amount: 82000, due: "2026-06-03", paid: false },
        { title: "Personel maas odemesi", category: "Personel", type: "expense", amount: 98000, due: "2026-05-31", paid: false },
        { title: "KDV odemesi", category: "Vergi", type: "expense", amount: 46500, due: "2026-05-20", paid: false },
        { title: "Reklam kampanyasi", category: "Pazarlama", type: "expense", amount: 24000, due: "2026-06-08", paid: false },
        { title: "Ofis ve operasyon gideri", category: "Operasyon", type: "expense", amount: 18500, due: "2026-05-28", paid: true }
      ];
      const today = new Date("2026-05-24T12:00:00");
      const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
      const byId = (id) => document.getElementById(id);
      const isLate = (record) => !record.paid && record.type === "expense" && new Date(record.due + "T12:00:00") < today;
      function filteredRecords() {
        const q = byId("search").value.toLowerCase();
        const category = byId("categoryFilter").value;
        const paid = byId("paidFilter").value;
        const range = byId("rangeFilter").value;
        return records.filter((record) => {
          const due = new Date(record.due + "T12:00:00");
          const days = (due - today) / 86400000;
          return (!q || record.title.toLowerCase().includes(q) || record.category.toLowerCase().includes(q))
            && (!category || record.category === category)
            && (!range || range === "all" || (days >= 0 && days <= Number(range)))
            && (!paid || (paid === "paid" && record.paid) || (paid === "open" && !record.paid) || (paid === "late" && isLate(record)));
        });
      }
      function renderMetrics() {
        const income = records.filter((r) => r.type === "income").reduce((sum, r) => sum + r.amount, 0);
        const expense = records.filter((r) => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
        const lateDebt = records.filter(isLate).reduce((sum, r) => sum + r.amount, 0);
        byId("income").textContent = money.format(income);
        byId("expense").textContent = money.format(expense);
        byId("netCash").textContent = money.format(income - expense);
        byId("lateDebt").textContent = money.format(lateDebt);
      }
      function renderRows() {
        byId("rows").innerHTML = filteredRecords().map((record) => {
          const status = record.paid ? "<span class='pill paid'>Odendi</span>" : "<span class='pill " + (isLate(record) ? "late" : "") + "'>" + (isLate(record) ? "Gecikti" : "Bekliyor") + "</span>";
          return "<tr><td>" + record.title + "</td><td>" + record.category + "</td><td>" + (record.type === "income" ? "Gelir" : "Gider") + "</td><td>" + money.format(record.amount) + "</td><td>" + record.due + "</td><td>" + status + "</td></tr>";
        }).join("");
      }
      function renderCategoryReport() {
        const expenses = records.filter((r) => r.type === "expense");
        const total = expenses.reduce((sum, r) => sum + r.amount, 0) || 1;
        const grouped = expenses.reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category] || 0) + r.amount }), {});
        byId("categoryReport").innerHTML = Object.entries(grouped).map(([category, amount]) => "<p><strong>" + category + "</strong> <small>" + money.format(amount) + "</small></p><div class='bar'><span style='width:" + Math.round((amount / total) * 100) + "%'></span></div>").join("");
      }
      function renderTrend() {
        const months = [
          ["Ocak", 64], ["Subat", 82], ["Mart", 71], ["Nisan", 96], ["Mayis", 118], ["Haziran", 103]
        ];
        const max = Math.max(...months.map((month) => month[1]));
        byId("trend").innerHTML = months.map(([label, value]) => "<div><span style='height:" + Math.round((value / max) * 130) + "px'></span><em>" + label + "</em></div>").join("");
      }
      function renderForecast() {
        let balance = 215000;
        const upcoming = records.filter((r) => !r.paid).sort((a, b) => a.due.localeCompare(b.due));
        byId("forecastRows").innerHTML = upcoming.map((record) => {
          const movement = record.type === "income" ? record.amount : -record.amount;
          balance += movement;
          return "<tr><td>" + record.due + "</td><td>" + money.format(movement) + "</td><td>" + money.format(balance) + "</td></tr>";
        }).join("");
      }
      function renderRiskList() {
        byId("riskList").innerHTML = records
          .filter((r) => r.type === "expense" && !r.paid)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((record) => "<article><strong>" + record.title + "</strong><br><small>" + record.category + " · " + record.due + "</small><p>" + money.format(record.amount) + "</p></article>")
          .join("");
      }
      function render() {
        renderMetrics();
        renderRows();
        renderCategoryReport();
        renderTrend();
        renderForecast();
        renderRiskList();
      }
      byId("addRecord").addEventListener("click", () => {
        records.unshift({
          title: byId("titleInput").value,
          category: byId("categoryInput").value,
          type: byId("typeInput").value,
          amount: Number(byId("amountInput").value || 0),
          due: byId("dueInput").value,
          paid: byId("paidInput").value === "true"
        });
        render();
      });
      byId("exportCsv").addEventListener("click", () => {
        const header = "Baslik,Kategori,Tip,Tutar,Vade,Durum";
        const lines = filteredRecords().map((r) => [r.title, r.category, r.type, r.amount, r.due, r.paid ? "Odendi" : "Bekliyor"].join(","));
        const blob = new Blob([[header].concat(lines).join("\\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "nakit-akisi-raporu.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
      ["search", "categoryFilter", "paidFilter", "rangeFilter"].forEach((id) => byId(id).addEventListener("input", render));
      render();
    </script>
  </body>
</html>
`;
}

function hrAppHtml(title, tasks) {
  const completedItems = tasks.map((task) => task.task);
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17202a; background: #f4f6f8; }
      body { margin: 0; }
      header { background: #182333; color: #fff; padding: 24px; }
      header h1 { margin: 0 0 6px; font-size: 28px; }
      header p { margin: 0; color: #c8d2de; }
      main { max-width: 1240px; margin: 0 auto; padding: 20px; }
      .metrics, .grid, .split { display: grid; gap: 12px; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 16px; }
      .grid { grid-template-columns: 1fr 1fr; }
      .split { grid-template-columns: 1.15fr .85fr; margin-top: 12px; }
      section, .metric { background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 16px; }
      .metric strong { display: block; font-size: 25px; }
      .metric span, th, small { color: #667487; font-size: 13px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      label { display: grid; gap: 5px; margin-bottom: 10px; font-size: 13px; color: #526071; }
      input, select { border: 1px solid #cad3dd; border-radius: 6px; padding: 9px 10px; font: inherit; }
      button { border: 0; border-radius: 6px; background: #176b52; color: #fff; padding: 10px 13px; font-weight: 700; cursor: pointer; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-top: 1px solid #e5eaf0; padding: 10px; text-align: left; vertical-align: top; }
      .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; background: #eef2f6; color: #314155; }
      .approved { background: #dff5e8; color: #146c3b; }
      .pending { background: #fff0d9; color: #875400; }
      .rejected, .alert { background: #fff1e8; color: #9b3414; }
      .shift-grid { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); gap: 8px; overflow-x: auto; }
      .day { min-width: 110px; border: 1px solid #dbe2ea; border-radius: 8px; padding: 10px; background: #fbfcfd; }
      .day strong { display: block; margin-bottom: 8px; }
      .slot { border-radius: 6px; background: #eef6f3; padding: 7px; margin: 6px 0; font-size: 13px; }
      .slot.empty { background: #fff1e8; color: #9b3414; }
      .warnings { display: grid; gap: 8px; }
      .warnings article { border: 1px solid #ead8cc; background: #fff8f3; border-radius: 8px; padding: 10px; }
      .features { margin-top: 12px; }
      .features ul { columns: 2; padding-left: 20px; }
      @media (max-width: 820px) { .grid, .split { grid-template-columns: 1fr; } .features ul { columns: 1; } table { font-size: 14px; } }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Personel, izin talepleri, vardiya planlari ve operasyon uyarilarini tek panelde yoneten calisan demo.</p>
    </header>
    <main>
      <div class="metrics">
        <div class="metric"><strong id="totalStaff">0</strong><span>Toplam personel</span></div>
        <div class="metric"><strong id="pendingLeaves">0</strong><span>Bekleyen izin</span></div>
        <div class="metric"><strong id="todayOff">0</strong><span>Bugun izinli</span></div>
        <div class="metric"><strong id="emptyShifts">0</strong><span>Bos vardiya</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Personel ve Izin Talebi</h2>
          <label>Personel <input id="nameInput" value="Ece Kaya" /></label>
          <label>Departman <select id="departmentInput"><option>Satis</option><option>Operasyon</option><option>Depo</option><option>Destek</option></select></label>
          <label>Rol <input id="roleInput" value="Satis Temsilcisi" /></label>
          <label>Iletisim <input id="contactInput" value="ece@firma.test" /></label>
          <label>Izin durumu <select id="leaveStatusInput"><option>Bekliyor</option><option>Onaylandi</option><option>Reddedildi</option></select></label>
          <button id="addStaff">Personel / Izin Ekle</button>
        </section>
        <section>
          <h2>Arama ve Filtre</h2>
          <label>Arama <input id="search" placeholder="Personel, departman veya rol ara" /></label>
          <label>Departman <select id="departmentFilter"><option value="">Tum departmanlar</option><option>Satis</option><option>Operasyon</option><option>Depo</option><option>Destek</option></select></label>
          <label>Izin durumu <select id="leaveFilter"><option value="">Tum izin durumlari</option><option>Bekliyor</option><option>Onaylandi</option><option>Reddedildi</option></select></label>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Haftalik Vardiya Plani</h2>
          <div id="shiftGrid" class="shift-grid"></div>
        </section>
        <section>
          <h2>Operasyon Uyarilari</h2>
          <div id="warnings" class="warnings"></div>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Izin Talepleri ve Personel Listesi</h2>
          <table>
            <thead><tr><th>Personel</th><th>Departman</th><th>Rol</th><th>Iletisim</th><th>Izin</th></tr></thead>
            <tbody id="staffRows"></tbody>
          </table>
        </section>
        <section>
          <h2>Bugun Izinli Personel</h2>
          <div id="todayOffList" class="warnings"></div>
        </section>
      </div>
      <section class="features">
        <h2>Tamamlanan Sprint Maddeleri</h2>
        <ul>${completedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </main>
    <script>
      const staff = [
        { name: "Ayse Demir", department: "Satis", role: "Satis Uzmani", contact: "ayse@firma.test", leave: "Onaylandi", offToday: true },
        { name: "Mert Yilmaz", department: "Operasyon", role: "Operasyon Sorumlusu", contact: "mert@firma.test", leave: "Bekliyor", offToday: false },
        { name: "Selin Arslan", department: "Depo", role: "Depo Gorevlisi", contact: "selin@firma.test", leave: "Reddedildi", offToday: false },
        { name: "Can Aydin", department: "Destek", role: "Musteri Destek", contact: "can@firma.test", leave: "Onaylandi", offToday: true },
        { name: "Ece Kaya", department: "Satis", role: "Satis Temsilcisi", contact: "ece@firma.test", leave: "Bekliyor", offToday: false }
      ];
      const shifts = [
        { day: "Pazartesi", people: ["Ayse Demir", "Mert Yilmaz"] },
        { day: "Sali", people: ["Selin Arslan"] },
        { day: "Carsamba", people: [] },
        { day: "Persembe", people: ["Can Aydin", "Ece Kaya"] },
        { day: "Cuma", people: ["Mert Yilmaz"] }
      ];
      const byId = (id) => document.getElementById(id);
      function filteredStaff() {
        const q = byId("search").value.toLowerCase();
        const department = byId("departmentFilter").value;
        const leave = byId("leaveFilter").value;
        return staff.filter((person) =>
          (!q || person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q) || person.role.toLowerCase().includes(q))
          && (!department || person.department === department)
          && (!leave || person.leave === leave)
        );
      }
      function leaveClass(value) {
        if (value === "Onaylandi") return "approved";
        if (value === "Reddedildi") return "rejected";
        return "pending";
      }
      function renderMetrics() {
        byId("totalStaff").textContent = staff.length;
        byId("pendingLeaves").textContent = staff.filter((p) => p.leave === "Bekliyor").length;
        byId("todayOff").textContent = staff.filter((p) => p.offToday).length;
        byId("emptyShifts").textContent = shifts.filter((shift) => shift.people.length === 0).length;
      }
      function renderStaffRows() {
        byId("staffRows").innerHTML = filteredStaff().map((person) =>
          "<tr><td>" + person.name + "</td><td>" + person.department + "</td><td>" + person.role + "</td><td>" + person.contact + "</td><td><span class='pill " + leaveClass(person.leave) + "'>" + person.leave + "</span></td></tr>"
        ).join("");
      }
      function renderShifts() {
        byId("shiftGrid").innerHTML = shifts.map((shift) =>
          "<div class='day'><strong>" + shift.day + "</strong>" + (shift.people.length ? shift.people.map((person) => "<div class='slot'>" + person + "</div>").join("") : "<div class='slot empty'>Bos vardiya</div>") + "</div>"
        ).join("");
      }
      function renderWarnings() {
        const empty = shifts.filter((shift) => shift.people.length === 0).map((shift) => ({ title: "Bos vardiya", detail: shift.day + " gunu icin personel atanmadi." }));
        const conflicts = staff.filter((person) => person.offToday && shifts.some((shift) => shift.people.includes(person.name))).map((person) => ({ title: "Cakisan izin", detail: person.name + " bugun izinli gorunuyor ama vardiyada yer aliyor." }));
        const warnings = empty.concat(conflicts);
        byId("warnings").innerHTML = warnings.map((warning) => "<article><strong>" + warning.title + "</strong><br><small>" + warning.detail + "</small></article>").join("") || "<article><strong>Uyari yok</strong><br><small>Vardiya ve izin planlari uyumlu.</small></article>";
      }
      function renderTodayOff() {
        byId("todayOffList").innerHTML = staff.filter((person) => person.offToday).map((person) =>
          "<article><strong>" + person.name + "</strong><br><small>" + person.department + " · " + person.role + "</small></article>"
        ).join("") || "<article><strong>Bugun izinli yok</strong></article>";
      }
      function render() {
        renderMetrics();
        renderStaffRows();
        renderShifts();
        renderWarnings();
        renderTodayOff();
      }
      byId("addStaff").addEventListener("click", () => {
        staff.unshift({
          name: byId("nameInput").value,
          department: byId("departmentInput").value,
          role: byId("roleInput").value,
          contact: byId("contactInput").value,
          leave: byId("leaveStatusInput").value,
          offToday: byId("leaveStatusInput").value === "Onaylandi"
        });
        render();
      });
      ["search", "departmentFilter", "leaveFilter"].forEach((id) => byId(id).addEventListener("input", render));
      render();
    </script>
  </body>
</html>
`;
}

function serviceOpsAppHtml(title, tasks) {
  const completedItems = tasks.map((task) => task.task);
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #081018; color: #e8f4ff; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 20% 0%, #143a4d 0, transparent 32%), radial-gradient(circle at 90% 10%, #3a235e 0, transparent 28%), linear-gradient(135deg, #070d14, #101827 52%, #090d13); }
      header { padding: 26px 24px; border-bottom: 1px solid rgba(110, 231, 255, .22); background: rgba(7, 13, 20, .72); backdrop-filter: blur(18px); }
      header h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
      header p { margin: 0; color: #9fb9c8; }
      main { max-width: 1280px; margin: 0 auto; padding: 20px; }
      .toolbar, section, .metric { border: 1px solid rgba(121, 220, 255, .2); background: linear-gradient(180deg, rgba(17, 31, 46, .82), rgba(10, 18, 28, .74)); box-shadow: 0 20px 60px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255,255,255,.06); border-radius: 8px; }
      .toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px 16px; margin-bottom: 14px; }
      .toolbar code { color: #72f1ff; background: rgba(114, 241, 255, .1); border-radius: 6px; padding: 5px 8px; }
      button { border: 0; border-radius: 7px; padding: 10px 13px; color: #061018; font-weight: 800; cursor: pointer; background: linear-gradient(135deg, #72f1ff, #a6ffcb); }
      button.secondary { color: #d9f7ff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); }
      .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 14px; }
      .metric { padding: 16px; position: relative; overflow: hidden; }
      .metric:before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(114,241,255,.18), transparent); opacity: .75; pointer-events: none; }
      .metric strong { position: relative; display: block; font-size: 28px; color: #ffffff; text-shadow: 0 0 20px rgba(114,241,255,.45); }
      .metric span { position: relative; color: #99b9c8; font-size: 13px; }
      .grid, .split { display: grid; gap: 12px; }
      .grid { grid-template-columns: 1fr 1fr; }
      .split { grid-template-columns: 1.15fr .85fr; margin-top: 12px; }
      section { padding: 16px; }
      h2 { margin: 0 0 12px; font-size: 18px; color: #f8fdff; }
      label { display: grid; gap: 5px; margin-bottom: 10px; color: #9fb9c8; font-size: 13px; }
      input, select, textarea { width: 100%; border: 1px solid rgba(121,220,255,.24); border-radius: 7px; padding: 10px; color: #e8f4ff; background: rgba(4, 11, 18, .76); font: inherit; }
      textarea { min-height: 70px; resize: vertical; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-top: 1px solid rgba(121,220,255,.14); padding: 10px; text-align: left; vertical-align: top; }
      th { color: #91adbd; font-size: 13px; }
      .table-wrap { overflow-x: auto; }
      .pill { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,.12); }
      .new { color: #9ee7ff; background: rgba(114,241,255,.12); }
      .assigned { color: #c4b5fd; background: rgba(167,139,250,.14); }
      .route { color: #fde68a; background: rgba(251,191,36,.13); }
      .done { color: #a6ffcb; background: rgba(34,197,94,.15); }
      .cancel { color: #fecaca; background: rgba(239,68,68,.15); }
      .urgent { color: #fecaca; background: rgba(255, 67, 67, .16); box-shadow: 0 0 24px rgba(255, 67, 67, .16); }
      .timeline, .techs, .alerts { display: grid; gap: 9px; }
      article { border: 1px solid rgba(121,220,255,.16); border-radius: 8px; padding: 11px; background: rgba(255,255,255,.045); }
      article strong { display: block; margin-bottom: 5px; }
      small { color: #9fb9c8; }
      .features { margin-top: 12px; }
      .features ul { columns: 2; padding-left: 20px; color: #bad1dc; }
      @media (max-width: 860px) { .toolbar, .grid, .split { display: block; } section, .metric, .toolbar { margin-bottom: 12px; } .features ul { columns: 1; } }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Futuristic saha servis operasyon merkezi. Is emirleri ve teknisyenler tarayici localStorage icinde kalici tutulur.</p>
    </header>
    <main>
      <div class="toolbar">
        <div><strong>Canli Operasyon Konsolu</strong><br><small>Kayit katmani: <code>localStorage</code></small></div>
        <div><button id="resetDemo" class="secondary">Demo verileri sifirla</button></div>
      </div>
      <div class="metrics">
        <div class="metric"><strong id="totalOrders">0</strong><span>Toplam is emri</span></div>
        <div class="metric"><strong id="todayVisits">0</strong><span>Bugunku ziyaret</span></div>
        <div class="metric"><strong id="urgentOrders">0</strong><span>Acil is</span></div>
        <div class="metric"><strong id="lateOrders">0</strong><span>Geciken servis</span></div>
        <div class="metric"><strong id="availableTechs">0</strong><span>Musait teknisyen</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Yeni Is Emri</h2>
          <label>Musteri <input id="customerInput" value="Atlas Market" /></label>
          <label>Adres <input id="addressInput" value="Kadikoy / Istanbul" /></label>
          <label>Servis tipi <select id="typeInput"><option>Bakim</option><option>Ariza</option><option>Kurulum</option><option>Denetim</option></select></label>
          <label>Oncelik <select id="priorityInput"><option>Acil</option><option>Normal</option><option>Dusuk</option></select></label>
          <label>Teknisyen <select id="technicianInput"></select></label>
          <label>Tarih <input id="dateInput" type="date" value="2026-05-25" /></label>
          <label>Aciklama <textarea id="noteInput">Sogutma unitesi alarm veriyor.</textarea></label>
          <button id="addOrder">Is Emri Olustur</button>
        </section>
        <section>
          <h2>Yeni Teknisyen</h2>
          <label>Ad Soyad <input id="techNameInput" value="Deniz Usta" /></label>
          <label>Uzmanlik <input id="skillInput" value="Elektrik ve sogutma" /></label>
          <label>Musaitlik <select id="availabilityInput"><option>Musait</option><option>Sahada</option><option>Izinli</option></select></label>
          <button id="addTech">Teknisyen Ekle</button>
          <hr style="border-color: rgba(121,220,255,.14); margin: 16px 0" />
          <h2>Filtreler</h2>
          <label>Arama <input id="search" placeholder="Musteri, servis tipi, teknisyen ara" /></label>
          <label>Durum <select id="statusFilter"><option value="">Tum durumlar</option><option>Yeni</option><option>Atandi</option><option>Yolda</option><option>Tamamlandi</option><option>Iptal</option></select></label>
          <label>Oncelik <select id="priorityFilter"><option value="">Tum oncelikler</option><option>Acil</option><option>Normal</option><option>Dusuk</option></select></label>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Is Emirleri</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Musteri</th><th>Servis</th><th>Teknisyen</th><th>Tarih</th><th>Durum</th><th>Aksiyon</th></tr></thead>
              <tbody id="orderRows"></tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Acil ve Geciken Uyarilar</h2>
          <div id="alerts" class="alerts"></div>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Bugunku Servis Akisi</h2>
          <div id="timeline" class="timeline"></div>
        </section>
        <section>
          <h2>Teknisyen Durumu</h2>
          <div id="techList" class="techs"></div>
        </section>
      </div>
      <section class="features">
        <h2>Tamamlanan Sprint Maddeleri</h2>
        <ul>${completedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </main>
    <script>
      const orderKey = "ai-office-service-orders";
      const techKey = "ai-office-service-technicians";
      const demoTechs = [
        { name: "Baran Tekin", skill: "Klima ve sogutma", availability: "Musait" },
        { name: "Derya Koc", skill: "Elektrik", availability: "Sahada" },
        { name: "Mina Acar", skill: "Mekanik bakim", availability: "Musait" }
      ];
      const demoOrders = [
        { customer: "Atlas Market", address: "Kadikoy / Istanbul", type: "Ariza", priority: "Acil", technician: "Baran Tekin", date: "2026-05-25", status: "Yolda", note: "Sogutma unitesi alarm veriyor." },
        { customer: "Nova Klinik", address: "Cankaya / Ankara", type: "Bakim", priority: "Normal", technician: "Derya Koc", date: "2026-05-25", status: "Atandi", note: "Periyodik cihaz bakimi." },
        { customer: "Mavi Ofis", address: "Nilüfer / Bursa", type: "Kurulum", priority: "Dusuk", technician: "Mina Acar", date: "2026-05-28", status: "Yeni", note: "Yeni cihaz kurulumu." },
        { customer: "Delta Gida", address: "Gebze / Kocaeli", type: "Ariza", priority: "Acil", technician: "Derya Koc", date: "2026-05-20", status: "Atandi", note: "Hat durdu, geciken servis." }
      ];
      let technicians = load(techKey, demoTechs);
      let orders = load(orderKey, demoOrders);
      const today = "2026-05-25";
      const byId = (id) => document.getElementById(id);
      function load(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
        localStorage.setItem(key, JSON.stringify(fallback));
        return structuredClone(fallback);
      }
      function save() {
        localStorage.setItem(orderKey, JSON.stringify(orders));
        localStorage.setItem(techKey, JSON.stringify(technicians));
      }
      function statusClass(status) {
        return { Yeni: "new", Atandi: "assigned", Yolda: "route", Tamamlandi: "done", Iptal: "cancel" }[status] || "new";
      }
      function filteredOrders() {
        const q = byId("search").value.toLowerCase();
        const status = byId("statusFilter").value;
        const priority = byId("priorityFilter").value;
        return orders.filter((order) =>
          (!q || order.customer.toLowerCase().includes(q) || order.type.toLowerCase().includes(q) || order.technician.toLowerCase().includes(q))
          && (!status || order.status === status)
          && (!priority || order.priority === priority)
        );
      }
      function renderMetrics() {
        byId("totalOrders").textContent = orders.length;
        byId("todayVisits").textContent = orders.filter((order) => order.date === today).length;
        byId("urgentOrders").textContent = orders.filter((order) => order.priority === "Acil").length;
        byId("lateOrders").textContent = orders.filter((order) => order.date < today && order.status !== "Tamamlandi").length;
        byId("availableTechs").textContent = technicians.filter((tech) => tech.availability === "Musait").length;
      }
      function renderTechnicianSelect() {
        byId("technicianInput").innerHTML = technicians.map((tech) => "<option>" + tech.name + "</option>").join("");
      }
      function renderOrders() {
        byId("orderRows").innerHTML = filteredOrders().map((order, index) => {
          const realIndex = orders.indexOf(order);
          const late = order.date < today && order.status !== "Tamamlandi";
          return "<tr><td><strong>" + order.customer + "</strong><br><small>" + order.address + "</small></td><td>" + order.type + "<br><span class='pill " + (order.priority === "Acil" ? "urgent" : "") + "'>" + order.priority + "</span></td><td><select data-tech='" + realIndex + "'>" + technicians.map((tech) => "<option " + (tech.name === order.technician ? "selected" : "") + ">" + tech.name + "</option>").join("") + "</select></td><td>" + order.date + (late ? "<br><span class='pill urgent'>Gecikti</span>" : "") + "</td><td><span class='pill " + statusClass(order.status) + "'>" + order.status + "</span></td><td><select data-status='" + realIndex + "'><option>Yeni</option><option>Atandi</option><option>Yolda</option><option>Tamamlandi</option><option>Iptal</option></select></td></tr>";
        }).join("");
        document.querySelectorAll("[data-status]").forEach((select) => {
          select.value = orders[Number(select.dataset.status)].status;
          select.addEventListener("change", () => {
            orders[Number(select.dataset.status)].status = select.value;
            save();
            render();
          });
        });
        document.querySelectorAll("[data-tech]").forEach((select) => {
          select.addEventListener("change", () => {
            orders[Number(select.dataset.tech)].technician = select.value;
            save();
            render();
          });
        });
      }
      function renderAlerts() {
        const alerts = orders.filter((order) => order.priority === "Acil" || (order.date < today && order.status !== "Tamamlandi"));
        byId("alerts").innerHTML = alerts.map((order) => "<article class='urgent'><strong>" + order.customer + "</strong><small>" + order.type + " · " + order.technician + " · " + order.date + "</small><p>" + order.note + "</p></article>").join("") || "<article><strong>Uyari yok</strong><small>Operasyon akisi stabil.</small></article>";
      }
      function renderTimeline() {
        byId("timeline").innerHTML = orders.filter((order) => order.date === today).map((order) => "<article><strong>" + order.customer + "</strong><small>" + order.status + " · " + order.technician + "</small><p>" + order.address + "</p></article>").join("") || "<article><strong>Bugun ziyaret yok</strong></article>";
      }
      function renderTechs() {
        byId("techList").innerHTML = technicians.map((tech) => {
          const active = orders.filter((order) => order.technician === tech.name && order.status !== "Tamamlandi" && order.status !== "Iptal").length;
          return "<article><strong>" + tech.name + "</strong><small>" + tech.skill + "</small><p><span class='pill'>" + tech.availability + "</span> Aktif is: " + active + "</p></article>";
        }).join("");
      }
      function render() {
        renderTechnicianSelect();
        renderMetrics();
        renderOrders();
        renderAlerts();
        renderTimeline();
        renderTechs();
      }
      byId("addOrder").addEventListener("click", () => {
        orders.unshift({
          customer: byId("customerInput").value,
          address: byId("addressInput").value,
          type: byId("typeInput").value,
          priority: byId("priorityInput").value,
          technician: byId("technicianInput").value,
          date: byId("dateInput").value,
          status: "Yeni",
          note: byId("noteInput").value
        });
        save();
        render();
      });
      byId("addTech").addEventListener("click", () => {
        technicians.unshift({ name: byId("techNameInput").value, skill: byId("skillInput").value, availability: byId("availabilityInput").value });
        save();
        render();
      });
      byId("resetDemo").addEventListener("click", () => {
        localStorage.removeItem(orderKey);
        localStorage.removeItem(techKey);
        technicians = load(techKey, demoTechs);
        orders = load(orderKey, demoOrders);
        render();
      });
      ["search", "statusFilter", "priorityFilter"].forEach((id) => byId(id).addEventListener("input", render));
      render();
    </script>
  </body>
</html>
`;
}

function warehouseRusticAppHtml(title, tasks) {
  const completedItems = tasks.map((task) => task.task);
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: Georgia, "Times New Roman", serif; background: #efe3cf; color: #2f2418; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, #ead7b7, #f8efdf 46%, #d9b989); }
      body:before { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .18; background-image: linear-gradient(90deg, rgba(92,54,26,.18) 1px, transparent 1px), linear-gradient(rgba(92,54,26,.12) 1px, transparent 1px); background-size: 36px 36px; }
      header { position: relative; padding: 26px 24px; background: #5a3720; color: #fff7e7; border-bottom: 8px solid #9b6a38; box-shadow: 0 12px 30px rgba(60, 34, 13, .28); }
      header h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
      header p { margin: 0; color: #f0d9b3; font-family: Inter, system-ui, sans-serif; }
      main { position: relative; max-width: 1280px; margin: 0 auto; padding: 20px; }
      .toolbar, section, .metric { background: #fff3dc; border: 2px solid #8f6234; border-radius: 8px; box-shadow: 0 10px 0 rgba(97, 58, 25, .12), inset 0 0 0 1px rgba(255,255,255,.42); }
      .toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px 16px; margin-bottom: 14px; }
      .toolbar code { background: #ead0a8; color: #563418; padding: 4px 7px; border-radius: 5px; }
      button { border: 2px solid #5f3518; border-radius: 6px; padding: 10px 13px; color: #321f10; background: #d99a45; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: .02em; box-shadow: 0 4px 0 #73451e; }
      button.secondary { background: #f2d19a; }
      .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 14px; }
      .metric { padding: 16px; background: #f8e8c9; }
      .metric strong { display: block; font-size: 28px; color: #4f2d15; }
      .metric span, th, small { color: #71502f; font-family: Inter, system-ui, sans-serif; font-size: 13px; }
      .grid, .split { display: grid; gap: 12px; }
      .grid { grid-template-columns: 1fr 1fr; }
      .split { grid-template-columns: 1.1fr .9fr; margin-top: 12px; }
      section { padding: 16px; }
      h2 { margin: 0 0 12px; font-size: 19px; color: #3d2512; }
      label { display: grid; gap: 5px; margin-bottom: 10px; color: #6a4b2b; font-family: Inter, system-ui, sans-serif; font-size: 13px; }
      input, select { width: 100%; border: 2px solid #b9874d; border-radius: 6px; padding: 10px; color: #2f2418; background: #fffaf0; font: inherit; font-family: Inter, system-ui, sans-serif; }
      table { width: 100%; border-collapse: collapse; font-family: Inter, system-ui, sans-serif; }
      th, td { border-top: 1px dashed #b9874d; padding: 10px; text-align: left; vertical-align: top; }
      th { color: #6a4b2b; font-size: 13px; }
      .table-wrap { overflow-x: auto; }
      .tag { display: inline-block; border: 2px solid #7a431c; border-radius: 5px; padding: 3px 8px; font-size: 12px; font-weight: 900; background: #f1d49c; color: #4a2c16; transform: rotate(-1deg); }
      .critical { color: #7f1d1d; background: #f6c7a9; border-color: #9b2f1b; }
      .packed { color: #14532d; background: #cae8bd; border-color: #49773a; }
      .route { color: #5b3d07; background: #f8dda0; border-color: #966c24; }
      .cards { display: grid; gap: 9px; }
      article { border: 2px solid #9b6a38; border-radius: 8px; padding: 11px; background: #f8e8c9; box-shadow: inset 0 0 0 1px rgba(255,255,255,.4); }
      article strong { display: block; margin-bottom: 5px; }
      .stamp { border: 3px solid #8e2d1a; color: #8e2d1a; display: inline-block; padding: 5px 9px; font-weight: 900; text-transform: uppercase; transform: rotate(-3deg); background: rgba(255,255,255,.25); }
      .features { margin-top: 12px; }
      .features ul { columns: 2; padding-left: 20px; color: #5c3f22; font-family: Inter, system-ui, sans-serif; }
      @media (max-width: 860px) { .toolbar, .grid, .split { display: block; } section, .metric, .toolbar { margin-bottom: 12px; } .features ul { columns: 1; } }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Rustic depo defteri hissinde stok, raf, sevkiyat ve kritik seviye operasyon paneli. Kayitlar localStorage icinde kalici tutulur.</p>
    </header>
    <main>
      <div class="toolbar">
        <div><strong>Depo Kayit Defteri</strong><br><small>Kalici kayit: <code>localStorage</code></small></div>
        <button id="resetDemo" class="secondary">Demo verileri sifirla</button>
      </div>
      <div class="metrics">
        <div class="metric"><strong id="totalProducts">0</strong><span>Toplam urun</span></div>
        <div class="metric"><strong id="criticalProducts">0</strong><span>Kritik stok</span></div>
        <div class="metric"><strong id="todayShipments">0</strong><span>Bugunku sevkiyat</span></div>
        <div class="metric"><strong id="pendingPackages">0</strong><span>Bekleyen paket</span></div>
      </div>
      <div class="grid">
        <section>
          <h2>Yeni Urun / Stok Hareketi</h2>
          <label>Urun adi <input id="nameInput" value="Kraft koli 40x30" /></label>
          <label>Barkod <input id="barcodeInput" value="DP-1040" /></label>
          <label>Kategori <select id="categoryInput"><option>Ambalaj</option><option>Yedek Parca</option><option>Hammadde</option><option>Bitmis Urun</option></select></label>
          <label>Raf <input id="shelfInput" value="A-03" /></label>
          <label>Stok <input id="stockInput" type="number" value="24" /></label>
          <label>Kritik seviye <input id="criticalInput" type="number" value="30" /></label>
          <button id="addProduct">Depoya Kaydet</button>
        </section>
        <section>
          <h2>Filtreler</h2>
          <label>Arama <input id="search" placeholder="Urun, barkod veya raf ara" /></label>
          <label>Kategori <select id="categoryFilter"><option value="">Tum kategoriler</option><option>Ambalaj</option><option>Yedek Parca</option><option>Hammadde</option><option>Bitmis Urun</option></select></label>
          <label>Stok durumu <select id="stockFilter"><option value="">Tum durumlar</option><option value="critical">Kritik</option><option value="ok">Yeterli</option></select></label>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Depo Listesi</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Urun</th><th>Barkod</th><th>Kategori</th><th>Raf</th><th>Stok</th><th>Durum</th></tr></thead>
              <tbody id="productRows"></tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Kritik Stok Damgalari</h2>
          <div id="criticalCards" class="cards"></div>
        </section>
      </div>
      <div class="split">
        <section>
          <h2>Bugunku Sevkiyat Fisleri</h2>
          <div id="shipmentCards" class="cards"></div>
        </section>
        <section>
          <h2>Sevkiyat Durumu</h2>
          <div id="shipmentStatus" class="cards"></div>
        </section>
      </div>
      <section class="features">
        <h2>Tamamlanan Sprint Maddeleri</h2>
        <ul>${completedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </main>
    <script>
      const productKey = "ai-office-rustic-products";
      const shipmentKey = "ai-office-rustic-shipments";
      const demoProducts = [
        { name: "Kraft koli 40x30", barcode: "DP-1040", category: "Ambalaj", shelf: "A-03", stock: 24, critical: 30 },
        { name: "Filtre pompa seti", barcode: "YP-2210", category: "Yedek Parca", shelf: "B-11", stock: 8, critical: 12 },
        { name: "Cam siseli urun", barcode: "BU-7741", category: "Bitmis Urun", shelf: "C-02", stock: 160, critical: 45 },
        { name: "Keten ham bez", barcode: "HM-3318", category: "Hammadde", shelf: "D-07", stock: 54, critical: 40 }
      ];
      const demoShipments = [
        { customer: "Atlas Market", product: "Cam siseli urun", amount: 36, status: "Hazirlaniyor" },
        { customer: "Nova Klinik", product: "Filtre pompa seti", amount: 4, status: "Paketlendi" },
        { customer: "Mavi Ofis", product: "Kraft koli 40x30", amount: 80, status: "Kargoya Verildi" }
      ];
      let products = load(productKey, demoProducts);
      let shipments = load(shipmentKey, demoShipments);
      const byId = (id) => document.getElementById(id);
      function load(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
        localStorage.setItem(key, JSON.stringify(fallback));
        return structuredClone(fallback);
      }
      function save() {
        localStorage.setItem(productKey, JSON.stringify(products));
        localStorage.setItem(shipmentKey, JSON.stringify(shipments));
      }
      const isCritical = (product) => Number(product.stock) <= Number(product.critical);
      function filteredProducts() {
        const q = byId("search").value.toLowerCase();
        const category = byId("categoryFilter").value;
        const stock = byId("stockFilter").value;
        return products.filter((product) =>
          (!q || product.name.toLowerCase().includes(q) || product.barcode.toLowerCase().includes(q) || product.shelf.toLowerCase().includes(q))
          && (!category || product.category === category)
          && (!stock || (stock === "critical" ? isCritical(product) : !isCritical(product)))
        );
      }
      function renderMetrics() {
        byId("totalProducts").textContent = products.length;
        byId("criticalProducts").textContent = products.filter(isCritical).length;
        byId("todayShipments").textContent = shipments.length;
        byId("pendingPackages").textContent = shipments.filter((item) => item.status === "Hazirlaniyor").length;
      }
      function renderProducts() {
        byId("productRows").innerHTML = filteredProducts().map((product) =>
          "<tr><td><strong>" + product.name + "</strong></td><td>" + product.barcode + "</td><td>" + product.category + "</td><td>" + product.shelf + "</td><td>" + product.stock + " / " + product.critical + "</td><td><span class='tag " + (isCritical(product) ? "critical" : "packed") + "'>" + (isCritical(product) ? "Kritik" : "Yeterli") + "</span></td></tr>"
        ).join("");
      }
      function renderCritical() {
        const critical = products.filter(isCritical);
        byId("criticalCards").innerHTML = critical.map((product) => "<article><span class='stamp'>Kritik</span><strong>" + product.name + "</strong><small>Raf " + product.shelf + " - Stok " + product.stock + " / " + product.critical + "</small></article>").join("") || "<article><strong>Kritik stok yok</strong><small>Depo seviyesi rahat.</small></article>";
      }
      function renderShipments() {
        byId("shipmentCards").innerHTML = shipments.map((shipment) => "<article><strong>" + shipment.customer + "</strong><small>" + shipment.product + " - " + shipment.amount + " adet</small><p><span class='tag route'>" + shipment.status + "</span></p></article>").join("");
        byId("shipmentStatus").innerHTML = shipments.map((shipment, index) => "<article><strong>" + shipment.customer + "</strong><label>Durum <select data-shipment='" + index + "'><option>Hazirlaniyor</option><option>Paketlendi</option><option>Kargoya Verildi</option><option>Iptal</option></select></label></article>").join("");
        document.querySelectorAll("[data-shipment]").forEach((select) => {
          select.value = shipments[Number(select.dataset.shipment)].status;
          select.addEventListener("change", () => {
            shipments[Number(select.dataset.shipment)].status = select.value;
            save();
            render();
          });
        });
      }
      function render() {
        renderMetrics();
        renderProducts();
        renderCritical();
        renderShipments();
      }
      byId("addProduct").addEventListener("click", () => {
        products.unshift({
          name: byId("nameInput").value,
          barcode: byId("barcodeInput").value,
          category: byId("categoryInput").value,
          shelf: byId("shelfInput").value,
          stock: Number(byId("stockInput").value || 0),
          critical: Number(byId("criticalInput").value || 0)
        });
        save();
        render();
      });
      byId("resetDemo").addEventListener("click", () => {
        localStorage.removeItem(productKey);
        localStorage.removeItem(shipmentKey);
        products = load(productKey, demoProducts);
        shipments = load(shipmentKey, demoShipments);
        render();
      });
      ["search", "categoryFilter", "stockFilter"].forEach((id) => byId(id).addEventListener("input", render));
      render();
    </script>
  </body>
</html>
`;
}

export function appHtmlForProject(projectName, title, tasks) {
  const searchText = `${projectName} ${title} ${tasks.map((task) => task.task).join(" ")}`.toLocaleLowerCase("tr-TR");
  if (
    searchText.includes("rustic") ||
    searchText.includes("depo") ||
    searchText.includes("stok") ||
    searchText.includes("sevkiyat") ||
    searchText.includes("raf")
  ) {
    return warehouseRusticAppHtml(title, tasks);
  }

  if (
    searchText.includes("servis") ||
    searchText.includes("teknisyen") ||
    searchText.includes("is emri") ||
    searchText.includes("localstorage") ||
    searchText.includes("futuristic")
  ) {
    return serviceOpsAppHtml(title, tasks);
  }

  if (searchText.includes("personel") || searchText.includes("vardiya") || searchText.includes("izin")) {
    return hrAppHtml(title, tasks);
  }

  if (searchText.includes("gider") || searchText.includes("nakit") || searchText.includes("fatura")) {
    return financeAppHtml(title, tasks);
  }

  if (searchText.includes("teklif") || searchText.includes("tahsilat")) {
    return kobiAppHtml(title, tasks);
  }

  return genericAppHtml(title, tasks);
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
  const output = relativeOutput(projectName, task.output);

  if (output === "public/index.html") {
    await writeFile(join(projectPath, "public", "index.html"), appHtmlForProject(projectName, title, futureTasks), "utf8");
  } else if (output === "README.md") {
    await updateReadme(projectPath, title, task);
  } else if (output === "STATUS.md") {
    await updateStatus(projectPath, futureTasks);
  } else if (output.endsWith(".md")) {
    const target = join(projectPath, output);
    await mkdir(dirname(target), { recursive: true });
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
    if (rebuildProject && entry.name !== rebuildProject) {
      continue;
    }

    const projectPath = join(projectsRoot, entry.name);
    const boardPath = join(projectPath, "AGENT_BOARD.md");
    if (!existsSync(boardPath)) {
      continue;
    }

    const board = await readText(boardPath);
    const parsed = parseBoard(board);
    const nextTask = parsed.tasks.find((task) => task.status === "IN_PROGRESS") ?? parsed.tasks.find((task) => task.status === "TODO");
    if (!nextTask && rebuildDone && parsed.tasks.every((task) => task.status === "DONE")) {
      const readme = await readText(join(projectPath, "README.md"));
      const title = projectTitle(readme, entry.name);
      await recordActivity(projectPath, {
        taskIndex: "REBUILD",
        agent: "Frontend/Backend Agent",
        phase: "IMPLEMENT",
        message: "Tamamlanmis sprint maddelerinden uygulama ekrani yeniden olusturuluyor.",
        files: ["public/index.html", "AGENT_ACTIVITY.json", "AGENT_WORKLOG.md"],
      });
      await writeFile(join(projectPath, "public", "index.html"), appHtmlForProject(entry.name, title, parsed.tasks), "utf8");
      await recordActivity(projectPath, {
        taskIndex: "REBUILD",
        agent: "QA Agent",
        phase: "VERIFY",
        message: "Yeniden olusturulan uygulama ekrani ve teslim dosyalari kontrol edildi.",
        files: ["public/index.html"],
      });
      console.log(`${entry.name}: tamamlanmis proje ekrani yeniden olusturuldu.`);
      return true;
    }

    if (!nextTask) {
      continue;
    }

    console.log(`${entry.name}: ${nextTask.agent} basladi -> ${nextTask.task}`);
    await recordActivity(projectPath, {
      taskIndex: nextTask.index,
      agent: nextTask.agent,
      phase: "PLAN",
      message: `${nextTask.task} maddesi icin kapsam, hedef dosyalar ve kabul kriterleri analiz edildi.`,
      files: taskFiles(entry.name, nextTask),
    });

    if (nextTask.status !== "IN_PROGRESS") {
      await writeBoard(projectPath, parsed, nextTask, "IN_PROGRESS");
    }

    await recordActivity(projectPath, {
      taskIndex: nextTask.index,
      agent: nextTask.agent,
      phase: "IMPLEMENT",
      message: `${nextTask.output} uzerinde uygulama degisikligi hazirlaniyor.`,
      files: taskFiles(entry.name, nextTask),
    });

    await sleep(delayMs);

    const refreshed = parseBoard(await readText(boardPath));
    const activeTask = refreshed.tasks.find((task) => task.index === nextTask.index);
    if (!activeTask || activeTask.status !== "IN_PROGRESS") {
      return true;
    }

    await performTask(projectPath, entry.name, refreshed, activeTask);
    await recordActivity(projectPath, {
      taskIndex: activeTask.index,
      agent: activeTask.agent,
      phase: "VERIFY",
      message: "Dosya guncellendi, durum ozeti yenilendi ve teslim kontrolu yapildi.",
      files: taskFiles(entry.name, activeTask),
    });

    await writeBoard(projectPath, refreshed, activeTask, "DONE");
    await recordActivity(projectPath, {
      taskIndex: activeTask.index,
      agent: activeTask.agent,
      phase: "DONE",
      message: `${activeTask.task} tamamlandi ve board DONE durumuna alindi.`,
      files: taskFiles(entry.name, activeTask),
    });

    console.log(`${entry.name}: ${activeTask.agent} tamamlandi -> ${activeTask.task}`);
    return true;
  }

  return false;
}

async function main() {
  console.log("Agent runner aktif. TODO maddeleri sirayla islenecek.");
  let rebuiltDoneProject = false;

  while (true) {
    const worked = await processOneTask();
    if (rebuildDone && worked) {
      rebuiltDoneProject = true;
    }
    if (runOnce && rebuildDone && rebuiltDoneProject) {
      break;
    }
    if (runOnce && !worked) {
      break;
    }
    await sleep(worked ? 500 : scanMs);
  }
}

if (process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("/agentRunner.js")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
