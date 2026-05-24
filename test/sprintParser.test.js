import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAgentTasks,
  parseSprintMessage,
  sprintToIssue,
  sprintToTaskIssues,
  taskSummaryComment,
} from "../src/sprintParser.js";
import { buildProjectFiles, createProjectContext } from "../src/projectBuilder.js";

test("parses a Turkish sprint message", () => {
  const { sprint, warnings } = parseSprintMessage(`SPRINT BASLAT
Proje adi: KOBI Teklif Takip
Hedef: Teklif surecini takip etmek
Kullanici tipi: KOBI
Ana ozellikler:
1. Musteri kaydi
2. Teklif olusturma
Olmazsa olmazlar:
- PDF cikti
Sure: 5 gun
Butce limiti: Dusuk`);

  assert.equal(sprint.projectName, "KOBI Teklif Takip");
  assert.equal(sprint.goal, "Teklif surecini takip etmek");
  assert.deepEqual(sprint.features, ["Musteri kaydi", "Teklif olusturma"]);
  assert.deepEqual(sprint.mustHaves, ["PDF cikti"]);
  assert.equal(sprint.duration, "5 gun");
  assert.equal(sprint.budgetLimit, "Dusuk");
  assert.equal(warnings.length, 0);
});

test("builds a GitHub issue payload", () => {
  const { sprint, warnings } = parseSprintMessage(`SPRINT BASLAT
Proje adi: CRM
Hedef: Musteri takibi
Ana ozellikler:
1. Listeleme`);

  const issue = sprintToIssue(sprint, warnings);

  assert.equal(issue.title, "[Sprint] CRM");
  assert.match(issue.body, /Musteri takibi/);
  assert.deepEqual(issue.labels, ["sprint-intake", "agent-office"]);
});

test("builds task issues from sprint items", () => {
  const { sprint } = parseSprintMessage(`SPRINT BASLAT
Proje adi: CRM
Hedef: Musteri takibi
Ana ozellikler:
1. Listeleme
2. Arama
Olmazsa olmazlar:
1. Mobil uyum`);

  const parentIssue = {
    number: 10,
  };
  const context = createProjectContext(sprint, new Date("2026-05-22T20:00:00Z"));

  const tasks = sprintToTaskIssues(sprint, parentIssue, context);

  assert.equal(tasks.length, 4);
  assert.match(tasks[0].title, /\[CRM\] 01 Frontend\/Backend Agent: Listeleme/);
  assert.match(tasks[2].title, /\[CRM\] 03 Product\/QA Agent: Mobil uyum/);
  assert.match(tasks[3].title, /QA smoke test and delivery report/);
  assert.match(tasks[0].body, /Parent sprint: #10/);
  assert.match(tasks[0].body, /projects\/crm/);
});

test("builds parent task summary comment", () => {
  const context = {
    projectPath: "projects/crm",
    sprintPath: "projects/crm/sprints/sprint-20260522T20.md",
    taskPath: "projects/crm/tasks/sprint-20260522T20-tasks.md",
  };
  const comment = taskSummaryComment(
    { number: 10 },
    [
      { number: 11, title: "[CRM] 01 Frontend/Backend: Listeleme" },
      { number: 12, title: "[CRM] 02 QA: QA smoke test" },
    ],
    context,
  );

  assert.match(comment, /#11/);
  assert.match(comment, /#12/);
  assert.match(comment, /Parent sprint is done/);
  assert.match(comment, /projects\/crm/);
});

test("builds isolated project files", () => {
  const { sprint } = parseSprintMessage(`SPRINT BASLAT
Proje adi: KOBI Teklif Takip
Hedef: Teklif surecini takip etmek
Ana ozellikler:
1. Musteri kaydi`);

  const context = createProjectContext(sprint, new Date("2026-05-22T20:00:00Z"));
  const tasks = buildAgentTasks(sprint, context);
  const files = buildProjectFiles(sprint, context, tasks);

  assert.equal(context.projectSlug, "kobi-teklif-takip");
  assert.equal(context.projectPath, "projects/kobi-teklif-takip");
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/public/index.html"));
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/package.json"));
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/start.cmd"));
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/start.ps1"));
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/AGENT_BOARD.md"));
  assert.ok(files.some((file) => file.path === "projects/kobi-teklif-takip/STATUS.md"));
  assert.equal(tasks[0].agent, "Frontend/Backend Agent");
});

test("parses existing project target", () => {
  const { sprint } = parseSprintMessage(`SPRINT BASLAT
Proje adi: KOBI Teklif Takip Guncelleme
Mevcut proje: kobi-teklif-ve-tahsilat-takip
Hedef: Var olan teklif projesine raporlama eklemek
Ana ozellikler:
1. Rapor ekrani`);

  const context = createProjectContext(sprint, new Date("2026-05-22T20:00:00Z"));

  assert.equal(sprint.existingProject, "kobi-teklif-ve-tahsilat-takip");
  assert.equal(context.projectPath, "projects/kobi-teklif-ve-tahsilat-takip");
});
