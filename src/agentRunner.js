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

function appHtmlForProject(projectName, title, tasks) {
  const searchText = `${projectName} ${title} ${tasks.map((task) => task.task).join(" ")}`.toLocaleLowerCase("tr-TR");
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
      await writeFile(join(projectPath, "public", "index.html"), appHtmlForProject(entry.name, title, parsed.tasks), "utf8");
      console.log(`${entry.name}: tamamlanmis proje ekrani yeniden olusturuldu.`);
      return true;
    }

    if (!nextTask) {
      continue;
    }

    console.log(`${entry.name}: ${nextTask.agent} basladi -> ${nextTask.task}`);
    if (nextTask.status !== "IN_PROGRESS") {
      await writeBoard(projectPath, parsed, nextTask, "IN_PROGRESS");
    }
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
