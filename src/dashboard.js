import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const requestedPort = Number(process.env.DASHBOARD_PORT || 4100);
const root = process.cwd();
const projectsRoot = join(root, "projects");

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

function firstHeading(markdown, fallback) {
  const heading = markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "));

  return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

function field(markdown, label, fallback = "-") {
  const pattern = new RegExp(`^- ${label}:\\s*(.+)$`, "mi");
  const match = markdown.match(pattern);
  return match ? match[1].trim() : fallback;
}

function parseAgentBoard(markdown) {
  const rows = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }

    if (line.includes("---") || line.includes("Agent | Status")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/g, ""));

    if (cells.length < 5 || cells[0] === "#") {
      continue;
    }

    rows.push({
      index: cells[0],
      agent: cells[1],
      status: cells[2],
      task: cells[3],
      output: cells[4],
    });
  }

  return rows;
}

function statusClass(status) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function summarizeTasks(tasks) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;
      summary[task.status] = (summary[task.status] ?? 0) + 1;
      return summary;
    },
    { total: 0 },
  );
}

async function loadProjects() {
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const projects = [];

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const projectPath = join(projectsRoot, entry.name);
    const readme = await readText(join(projectPath, "README.md"));
    const status = await readText(join(projectPath, "STATUS.md"));
    const board = await readText(join(projectPath, "AGENT_BOARD.md"));
    const tasks = parseAgentBoard(board);
    const summary = summarizeTasks(tasks);

    projects.push({
      slug: entry.name,
      title: firstHeading(readme, entry.name),
      path: `projects/${entry.name}`,
      overallStatus: field(status, "Overall status", tasks.length > 0 ? "IN_PROGRESS" : "UNKNOWN"),
      runCommand: field(status, "Run command", "start.cmd"),
      verified: field(status, "Verified", "Not verified"),
      tasks,
      summary,
    });
  }

  return projects.sort((left, right) => left.title.localeCompare(right.title));
}

function renderProjectCard(project) {
  const done = project.summary.DONE ?? 0;
  const todo = project.summary.TODO ?? 0;
  const inProgress = project.summary.IN_PROGRESS ?? 0;
  const review = project.summary.REVIEW ?? 0;

  return `<section class="project" id="${escapeHtml(project.slug)}">
    <div class="project-head">
      <div>
        <h2>${escapeHtml(project.title)}</h2>
        <p>${escapeHtml(project.path)}</p>
      </div>
      <span class="badge ${statusClass(project.overallStatus)}">${escapeHtml(project.overallStatus)}</span>
    </div>
    <div class="metrics">
      <div><strong>${project.summary.total}</strong><span>Toplam</span></div>
      <div><strong>${todo}</strong><span>TODO</span></div>
      <div><strong>${inProgress}</strong><span>Devam</span></div>
      <div><strong>${review}</strong><span>Review</span></div>
      <div><strong>${done}</strong><span>DONE</span></div>
    </div>
    <div class="run">
      <code>cd ${escapeHtml(project.path)}</code>
      <code>${escapeHtml(project.runCommand)}</code>
    </div>
    <p class="verified">${escapeHtml(project.verified)}</p>
    ${renderTasks(project.tasks)}
  </section>`;
}

function renderTasks(tasks) {
  if (tasks.length === 0) {
    return `<div class="empty">Bu proje icin henuz AGENT_BOARD.md yok.</div>`;
  }

  return `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Agent</th>
          <th>Status</th>
          <th>Madde</th>
          <th>Output</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `<tr>
              <td>${escapeHtml(task.index)}</td>
              <td>${escapeHtml(task.agent)}</td>
              <td><span class="badge ${statusClass(task.status)}">${escapeHtml(task.status)}</span></td>
              <td>${escapeHtml(task.task)}</td>
              <td><code>${escapeHtml(task.output)}</code></td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function renderPage(projects) {
  const totalProjects = projects.length;
  const totalTasks = projects.reduce((sum, project) => sum + project.summary.total, 0);
  const doneTasks = projects.reduce((sum, project) => sum + (project.summary.DONE ?? 0), 0);

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Agent Office Dashboard</title>
    <style>
      :root {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #18202a;
        background: #f4f6f8;
      }
      body {
        margin: 0;
      }
      header {
        background: #0f1720;
        color: #ffffff;
        padding: 28px 32px;
      }
      header h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      header p {
        margin: 0;
        color: #b8c2cc;
      }
      main {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }
      .summary div,
      .project {
        background: #ffffff;
        border: 1px solid #d9e0e7;
        border-radius: 8px;
      }
      .summary div {
        padding: 16px;
      }
      .summary strong {
        display: block;
        font-size: 26px;
      }
      .summary span,
      .project p,
      .verified {
        color: #5f6b7a;
      }
      .project {
        margin-bottom: 18px;
        overflow: hidden;
      }
      .project-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 18px;
        border-bottom: 1px solid #e5e9ee;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 20px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(5, minmax(80px, 1fr));
        gap: 1px;
        background: #e5e9ee;
      }
      .metrics div {
        background: #fbfcfd;
        padding: 14px 18px;
      }
      .metrics strong {
        display: block;
        font-size: 20px;
      }
      .metrics span {
        color: #687586;
        font-size: 13px;
      }
      .run {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 18px 0;
      }
      code {
        background: #eef2f6;
        border-radius: 5px;
        padding: 4px 7px;
      }
      .verified {
        padding: 0 18px;
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 12px 14px;
        border-top: 1px solid #e5e9ee;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f8fafc;
        font-size: 13px;
        color: #4b5868;
      }
      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 700;
        background: #e8edf3;
        color: #314155;
      }
      .badge.done {
        background: #dff5e8;
        color: #146c3b;
      }
      .badge.todo {
        background: #fff0d9;
        color: #875400;
      }
      .badge.in-progress {
        background: #dcecff;
        color: #145ca8;
      }
      .badge.review {
        background: #efe8ff;
        color: #6042a6;
      }
      .empty {
        padding: 18px;
        color: #687586;
      }
      @media (max-width: 720px) {
        header {
          padding: 22px 18px;
        }
        main {
          padding: 14px;
        }
        .project-head,
        .run {
          display: block;
        }
        .metrics {
          grid-template-columns: repeat(2, minmax(80px, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>AI Agent Office Dashboard</h1>
      <p>Projeler, agent gorevleri, durumlar ve calistirma komutlari</p>
    </header>
    <main>
      <section class="summary">
        <div><strong>${totalProjects}</strong><span>Proje</span></div>
        <div><strong>${totalTasks}</strong><span>Toplam Task</span></div>
        <div><strong>${doneTasks}</strong><span>Tamamlanan</span></div>
      </section>
      ${projects.map(renderProjectCard).join("") || '<section class="project"><div class="empty">Henuz proje yok.</div></section>'}
    </main>
  </body>
</html>`;
}

function listen(port) {
  const server = createServer(async (_request, response) => {
    const projects = await loadProjects();
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderPage(projects));
  });

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Dashboard port ${port} dolu, ${port + 1} deneniyor...`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`AI Agent Office Dashboard running at http://localhost:${port}`);
  });
}

listen(requestedPort);
