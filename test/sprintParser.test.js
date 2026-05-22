import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSprintMessage, sprintToIssue } from "../src/sprintParser.js";

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
