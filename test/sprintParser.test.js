import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSprintMessage,
  sprintToIssue,
  sprintToTaskIssues,
  taskSummaryComment,
} from "../src/sprintParser.js";

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

  const tasks = sprintToTaskIssues(sprint, parentIssue);

  assert.equal(tasks.length, 4);
  assert.match(tasks[0].title, /\[Task\] CRM - 01 Feature: Listeleme/);
  assert.match(tasks[2].title, /\[Task\] CRM - 03 Requirement: Mobil uyum/);
  assert.match(tasks[3].title, /QA smoke test and delivery report/);
  assert.match(tasks[0].body, /Parent sprint: #10/);
});

test("builds parent task summary comment", () => {
  const comment = taskSummaryComment(
    { number: 10 },
    [
      { number: 11, title: "[Task] CRM - 01 Feature: Listeleme" },
      { number: 12, title: "[Task] CRM - 02 QA: QA smoke test" },
    ],
  );

  assert.match(comment, /#11/);
  assert.match(comment, /#12/);
  assert.match(comment, /Parent sprint is done/);
});
