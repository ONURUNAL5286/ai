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

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
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
  return match ? match[1].trim().replace(/^`|`$/g, "") : fallback;
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
    const activity = await readJson(join(projectPath, "AGENT_ACTIVITY.json"), []);
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
      activity: activity.slice(-30).reverse(),
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

  const nextTask = project.tasks.find((task) => task.status !== "DONE");

  return `<section class="project" id="${escapeHtml(project.slug)}">
    <div class="project-head">
      <div>
        <h2>${escapeHtml(project.title)}</h2>
        <p>${escapeHtml(project.path)}</p>
      </div>
      <span class="badge ${statusClass(project.overallStatus)}">${escapeHtml(project.overallStatus)}</span>
    </div>
    <div class="next-action">
      <span>Siradaki is</span>
      <strong>${escapeHtml(nextTask ? nextTask.task : "Tum maddeler tamamlandi")}</strong>
      <small>${escapeHtml(nextTask ? nextTask.agent : "QA Agent")}</small>
    </div>
    <div class="metrics">
      <div><strong>${project.summary.total}</strong><span>Madde</span></div>
      <div><strong>${todo}</strong><span>TODO</span></div>
      <div><strong>${inProgress}</strong><span>Devam</span></div>
      <div><strong>${review}</strong><span>Review</span></div>
      <div><strong>${done}</strong><span>DONE</span></div>
    </div>
    <div class="run">
      <code>cd ${escapeHtml(project.path)} && ${escapeHtml(project.runCommand)}</code>
      <a href="http://localhost:3000/project/${escapeHtml(project.slug)}/">Tek preview ekraninda ac</a>
    </div>
    <p class="verified">${escapeHtml(project.verified)}</p>
    <details>
      <summary>Agent gorevlerini goster</summary>
      ${renderTasks(project.tasks)}
    </details>
    <details>
      <summary>Canli agent calisma gunlugu</summary>
      ${renderActivity(project.activity)}
    </details>
  </section>`;
}

function renderSetupCard(project) {
  return `<section class="setup-card">
    <div>
      <strong>${escapeHtml(project.title)}</strong>
      <span>${escapeHtml(project.path)}</span>
    </div>
    <code>AGENT_BOARD.md yok</code>
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

function renderActivity(activity) {
  if (!activity || activity.length === 0) {
    return `<div class="empty">Bu proje icin henuz agent calisma gunlugu yok.</div>`;
  }

  return `<div class="activity">
    ${activity
      .map(
        (item) => `<article>
          <div>
            <strong>${escapeHtml(item.agent || "Agent")}</strong>
            <span>${escapeHtml(item.at || "")}</span>
          </div>
          <span class="badge ${statusClass(item.phase || "TODO")}">${escapeHtml(item.phase || "-")}</span>
          <p>${escapeHtml(item.message || "")}</p>
          ${
            item.files?.length
              ? `<code>${escapeHtml(item.files.join(", "))}</code>`
              : ""
          }
        </article>`,
      )
      .join("")}
  </div>`;
}

function agentColor(agent) {
  if (agent.includes("Frontend")) return "cyan";
  if (agent.includes("Product")) return "amber";
  if (agent.includes("QA")) return "green";
  if (agent.includes("Repo")) return "violet";
  return "blue";
}

function phaseText(phase = "") {
  const labels = {
    PLAN: "Plan yapiyor",
    IMPLEMENT: "Kod yaziyor",
    VERIFY: "Test ediyor",
    DONE: "Tamamladi",
    TODO: "Siradaki isi bekliyor",
    IN_PROGRESS: "Calisiyor",
  };

  return labels[phase] || phase || "Hazir";
}

function latestAgentStates(projects) {
  const byAgent = new Map();

  for (const project of projects) {
    for (const item of [...project.activity].reverse()) {
      const agent = item.agent || "Agent";
      const previous = byAgent.get(agent);
      if (!previous || String(item.at || "") > String(previous.at || "")) {
        byAgent.set(agent, {
          agent,
          projectTitle: project.title,
          phase: item.phase || "TODO",
          status: phaseText(item.phase),
          message: item.message || "Yeni is bekleniyor.",
          files: item.files || [],
          at: item.at || "",
        });
      }
    }

    const activeTask = project.tasks.find((task) => task.status === "IN_PROGRESS");
    if (activeTask) {
      byAgent.set(activeTask.agent, {
        agent: activeTask.agent,
        projectTitle: project.title,
        phase: "IN_PROGRESS",
        status: "Calisiyor",
        message: activeTask.task,
        files: [activeTask.output],
        at: new Date().toISOString(),
      });
    }
  }

  const expectedAgents = [
    "Product/QA Agent",
    "Frontend/Backend Agent",
    "QA Agent",
    "Repo Sync Agent",
  ];

  for (const agent of expectedAgents) {
    if (!byAgent.has(agent)) {
      const nextProject = projects.find((project) => project.tasks.some((task) => task.status !== "DONE"));
      const nextTask = nextProject?.tasks.find((task) => task.agent === agent && task.status !== "DONE")
        ?? nextProject?.tasks.find((task) => task.status !== "DONE");

      byAgent.set(agent, {
        agent,
        projectTitle: nextProject?.title || "AI Agent Office",
        phase: nextTask ? nextTask.status : "TODO",
        status: nextTask ? phaseText(nextTask.status) : "Yeni sprint bekliyor",
        message: nextTask?.task || "Yeni sprint gelince otomatik is bolumu yapilacak.",
        files: nextTask ? [nextTask.output] : [],
        at: "",
      });
    }
  }

  return expectedAgents.map((agent) => byAgent.get(agent));
}

function renderAgentOffice(projects) {
  const agents = latestAgentStates(projects);

  return `<section class="office">
    <div class="office-copy">
      <span>Canli 3D Agent Office</span>
      <h2>Agentlarin o an yaptigi isler</h2>
      <p>Her masa bir agenti temsil eder. Ustteki balonda agentin su anki fazi, proje adi ve dokundugu dosyalar gorunur.</p>
    </div>
    <div class="office-stage" aria-label="Canli 3D agent office">
      <div class="office-scene">
        <div class="office-floor"></div>
        ${agents
          .map(
            (state, index) => `<article class="agent-desk desk-${index + 1} tone-${agentColor(state.agent)}">
              <div class="agent-bubble">
                <strong>${escapeHtml(state.status)}</strong>
                <span>${escapeHtml(state.projectTitle)}</span>
                <p>${escapeHtml(state.message)}</p>
                ${
                  state.files.length
                    ? `<code>${escapeHtml(state.files.slice(0, 2).join(", "))}</code>`
                    : ""
                }
              </div>
              <div class="desk-top">
                <span class="screen"></span>
                <span class="keyboard"></span>
              </div>
              <div class="agent-avatar">
                <span>${escapeHtml(state.agent.split(/[ /]/).filter(Boolean).map((word) => word[0]).slice(0, 2).join(""))}</span>
              </div>
              <div class="agent-name">${escapeHtml(state.agent)}</div>
            </article>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderPage(projects) {
  const activeProjects = projects.filter((project) => project.tasks.length > 0);
  const setupProjects = projects.filter((project) => project.tasks.length === 0);
  const totalProjects = activeProjects.length;
  const totalTasks = activeProjects.reduce((sum, project) => sum + project.summary.total, 0);
  const doneTasks = activeProjects.reduce((sum, project) => sum + (project.summary.DONE ?? 0), 0);
  const nextTasks = activeProjects
    .flatMap((project) =>
      project.tasks
        .filter((task) => task.status !== "DONE")
        .slice(0, 2)
        .map((task) => ({ ...task, projectTitle: project.title })),
    )
    .slice(0, 5);

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
        background: #16202b;
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
      .section-title {
        margin: 22px 0 12px;
        font-size: 16px;
        color: #344255;
      }
      .office {
        display: grid;
        grid-template-columns: minmax(240px, 330px) 1fr;
        gap: 18px;
        align-items: stretch;
        margin: 0 0 18px;
        background: #101923;
        border: 1px solid #243345;
        border-radius: 8px;
        overflow: hidden;
      }
      .office-copy {
        padding: 22px;
        color: #ffffff;
        background: linear-gradient(180deg, #172434, #101923);
      }
      .office-copy span {
        display: inline-block;
        margin-bottom: 10px;
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .office-copy h2 {
        margin: 0 0 10px;
        color: #ffffff;
        font-size: 24px;
      }
      .office-copy p {
        margin: 0;
        color: #b9c6d4;
        line-height: 1.55;
      }
      .office-stage {
        min-height: 430px;
        padding: 22px;
        perspective: 1100px;
        background:
          linear-gradient(90deg, rgba(125, 211, 252, .08) 1px, transparent 1px),
          linear-gradient(0deg, rgba(125, 211, 252, .08) 1px, transparent 1px),
          radial-gradient(circle at 30% 18%, rgba(34, 211, 238, .22), transparent 26%),
          linear-gradient(145deg, #101923, #172434 62%, #0f1721);
        background-size: 44px 44px, 44px 44px, auto, auto;
      }
      .office-scene {
        position: relative;
        min-height: 386px;
        transform-style: preserve-3d;
      }
      .office-floor {
        position: absolute;
        left: 8%;
        right: 8%;
        bottom: 18px;
        height: 230px;
        border: 1px solid rgba(148, 163, 184, .32);
        border-radius: 8px;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, .1) 25%, transparent 25%) 0 0 / 36px 36px,
          linear-gradient(315deg, rgba(255, 255, 255, .08) 25%, transparent 25%) 0 0 / 36px 36px,
          linear-gradient(145deg, rgba(30, 41, 59, .96), rgba(15, 23, 42, .96));
        box-shadow: 0 28px 70px rgba(0, 0, 0, .38);
        transform: rotateX(62deg) rotateZ(-32deg) translateZ(-55px);
        transform-origin: center bottom;
      }
      .agent-desk {
        position: absolute;
        width: min(240px, 31vw);
        min-width: 188px;
        transform-style: preserve-3d;
      }
      .desk-1 { left: 6%; top: 124px; }
      .desk-2 { left: 34%; top: 52px; }
      .desk-3 { left: 58%; top: 156px; }
      .desk-4 { right: 3%; top: 40px; }
      .agent-bubble {
        position: absolute;
        left: 50%;
        bottom: 116px;
        z-index: 3;
        width: 230px;
        max-width: calc(100vw - 72px);
        padding: 11px 12px;
        border: 1px solid rgba(255, 255, 255, .18);
        border-radius: 8px;
        color: #ffffff;
        background: rgba(15, 23, 42, .92);
        box-shadow: 0 16px 38px rgba(0, 0, 0, .28);
        transform: translateX(-50%) translateZ(90px);
        backdrop-filter: blur(10px);
      }
      .agent-bubble::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -8px;
        width: 14px;
        height: 14px;
        background: rgba(15, 23, 42, .92);
        border-right: 1px solid rgba(255, 255, 255, .18);
        border-bottom: 1px solid rgba(255, 255, 255, .18);
        transform: translateX(-50%) rotate(45deg);
      }
      .agent-bubble strong,
      .agent-bubble span,
      .agent-bubble p {
        display: block;
      }
      .agent-bubble strong {
        color: #e0f2fe;
        font-size: 13px;
      }
      .agent-bubble span {
        margin-top: 3px;
        color: #93c5fd;
        font-size: 12px;
        font-weight: 700;
      }
      .agent-bubble p {
        margin: 6px 0 0;
        color: #d8e2ef;
        font-size: 12px;
        line-height: 1.35;
      }
      .agent-bubble code {
        display: inline-block;
        max-width: 100%;
        margin-top: 7px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #c4b5fd;
        background: rgba(255, 255, 255, .09);
      }
      .desk-top {
        position: relative;
        width: 142px;
        height: 78px;
        margin: 110px auto 0;
        border: 1px solid rgba(255, 255, 255, .22);
        border-radius: 8px;
        background: linear-gradient(145deg, #334155, #172033);
        box-shadow: 0 16px 0 #0b111c, 0 26px 34px rgba(0, 0, 0, .32);
        transform: rotateX(55deg) rotateZ(-24deg);
      }
      .screen {
        position: absolute;
        left: 38px;
        top: -34px;
        width: 64px;
        height: 42px;
        border: 3px solid #0f172a;
        border-radius: 6px;
        background: linear-gradient(160deg, rgba(255,255,255,.85), rgba(125,211,252,.42));
        box-shadow: 0 0 18px rgba(125, 211, 252, .5);
      }
      .keyboard {
        position: absolute;
        left: 42px;
        bottom: 17px;
        width: 58px;
        height: 18px;
        border-radius: 5px;
        background: rgba(226, 232, 240, .72);
      }
      .agent-avatar {
        position: absolute;
        left: 50%;
        top: 70px;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 50px;
        height: 50px;
        border: 3px solid rgba(255, 255, 255, .75);
        border-radius: 50%;
        color: #06111f;
        font-weight: 900;
        transform: translateX(-50%);
        box-shadow: 0 0 24px rgba(125, 211, 252, .34);
      }
      .agent-name {
        margin-top: 12px;
        color: #d9e6f5;
        font-size: 12px;
        font-weight: 800;
        text-align: center;
      }
      .tone-cyan .agent-avatar { background: #67e8f9; }
      .tone-amber .agent-avatar { background: #facc15; }
      .tone-green .agent-avatar { background: #86efac; }
      .tone-violet .agent-avatar { background: #c4b5fd; }
      .tone-blue .agent-avatar { background: #93c5fd; }
      .tone-cyan .agent-bubble { border-color: rgba(103, 232, 249, .38); }
      .tone-amber .agent-bubble { border-color: rgba(250, 204, 21, .38); }
      .tone-green .agent-bubble { border-color: rgba(134, 239, 172, .38); }
      .tone-violet .agent-bubble { border-color: rgba(196, 181, 253, .38); }
      .tone-blue .agent-bubble { border-color: rgba(147, 197, 253, .38); }
      .next-list {
        display: grid;
        gap: 10px;
        margin-bottom: 18px;
      }
      .next-list article,
      .setup-card {
        background: #ffffff;
        border: 1px solid #d9e0e7;
        border-radius: 8px;
        padding: 14px 16px;
      }
      .next-list article {
        display: grid;
        grid-template-columns: 180px 1fr 190px;
        gap: 14px;
        align-items: center;
      }
      .next-list span,
      .setup-card span {
        display: block;
        color: #687586;
        font-size: 13px;
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
      .next-action {
        padding: 16px 18px;
        border-bottom: 1px solid #e5e9ee;
      }
      .next-action span,
      .next-action small {
        display: block;
        color: #687586;
      }
      .next-action strong {
        display: block;
        margin: 4px 0;
      }
      details {
        border-top: 1px solid #e5e9ee;
      }
      summary {
        cursor: pointer;
        padding: 14px 18px;
        font-weight: 700;
      }
      .table-wrap {
        overflow-x: auto;
      }
      .activity {
        display: grid;
        gap: 10px;
        padding: 0 18px 18px;
      }
      .activity article {
        display: grid;
        grid-template-columns: minmax(180px, 240px) 110px 1fr;
        gap: 12px;
        align-items: start;
        border-top: 1px solid #e5e9ee;
        padding-top: 12px;
      }
      .activity article div span {
        display: block;
        color: #687586;
        font-size: 12px;
      }
      .activity article p {
        margin: 0;
        color: #2f3b4a;
      }
      .activity article code {
        grid-column: 3;
        justify-self: start;
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
      .setup-list {
        display: grid;
        gap: 10px;
        margin-bottom: 24px;
      }
      .setup-card {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      @media (max-width: 720px) {
        header {
          padding: 22px 18px;
        }
        main {
          padding: 14px;
        }
        .project-head,
        .run,
        .next-list article,
        .setup-card {
          display: block;
        }
        .metrics {
          grid-template-columns: repeat(2, minmax(80px, 1fr));
        }
        .activity article {
          grid-template-columns: 1fr;
        }
        .activity article code {
          grid-column: auto;
        }
        .office {
          grid-template-columns: 1fr;
        }
        .office-stage {
          min-height: 760px;
          padding: 16px;
        }
        .office-floor {
          display: none;
        }
        .agent-desk {
          position: relative;
          left: auto;
          right: auto;
          top: auto;
          width: 100%;
          min-width: 0;
          height: 166px;
          margin-bottom: 18px;
        }
        .agent-bubble {
          left: 0;
          bottom: 62px;
          width: auto;
          transform: none;
        }
        .desk-top {
          margin: 98px 26px 0 auto;
        }
        .agent-avatar {
          left: 32px;
          top: 108px;
          transform: none;
        }
        .agent-name {
          position: absolute;
          left: 88px;
          top: 118px;
          margin: 0;
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>AI Agent Office Dashboard</h1>
      <p>Aktif projeler, siradaki isler ve agent durumlari</p>
    </header>
    <main>
      <section class="summary">
        <div><strong>${totalProjects}</strong><span>Aktif Proje</span></div>
        <div><strong>${totalTasks}</strong><span>Toplam Madde</span></div>
        <div><strong>${doneTasks}</strong><span>Tamamlanan</span></div>
      </section>
      ${renderAgentOffice(activeProjects)}
      <h2 class="section-title">Siradaki Isler</h2>
      <section class="next-list">
        ${
          nextTasks
            .map(
              (task) => `<article>
                <div><strong>${escapeHtml(task.projectTitle)}</strong><span>${escapeHtml(task.agent)}</span></div>
                <div>${escapeHtml(task.task)}</div>
                <span class="badge ${statusClass(task.status)}">${escapeHtml(task.status)}</span>
              </article>`,
            )
            .join("") || '<article><div><strong>Hazir</strong><span>Yeni task bekleniyor</span></div><div>Tamamlanacak madde yok.</div><span class="badge done">DONE</span></article>'
        }
      </section>
      <h2 class="section-title">Aktif Projeler</h2>
      ${activeProjects.map(renderProjectCard).join("") || '<section class="project"><div class="empty">Henuz aktif proje yok.</div></section>'}
      ${
        setupProjects.length > 0
          ? `<h2 class="section-title">Kurulum Bekleyen / Eski Projeler</h2>
            <section class="setup-list">${setupProjects.map(renderSetupCard).join("")}</section>`
          : ""
      }
    </main>
    <script>
      const details = Array.from(document.querySelectorAll(".project details"));

      for (const detail of details) {
        const project = detail.closest(".project");
        const key = "agent-board-open:" + (project ? project.id : "");
        detail.open = localStorage.getItem(key) === "true";
        detail.addEventListener("toggle", () => {
          localStorage.setItem(key, detail.open ? "true" : "false");
        });
      }

      setInterval(() => {
        window.location.reload();
      }, 1000);
    </script>
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
