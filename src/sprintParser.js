const FIELD_ALIASES = new Map([
  ["proje adi", "projectName"],
  ["proje adı", "projectName"],
  ["hedef", "goal"],
  ["kullanici tipi", "userType"],
  ["kullanıcı tipi", "userType"],
  ["ana ozellikler", "features"],
  ["ana özellikler", "features"],
  ["olmazsa olmazlar", "mustHaves"],
  ["teknik tercih", "technicalPreference"],
  ["teslim kriteri", "deliveryCriteria"],
  ["sure", "duration"],
  ["süre", "duration"],
  ["butce limiti", "budgetLimit"],
  ["bütçe limiti", "budgetLimit"],
  ["notlar", "notes"],
]);

const MULTILINE_FIELDS = new Set([
  "features",
  "mustHaves",
  "technicalPreference",
  "deliveryCriteria",
  "notes",
]);

function normalizeKey(key) {
  return key
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

function cleanListLine(line) {
  return line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim();
}

function emptySprint() {
  return {
    projectName: "",
    goal: "",
    userType: "",
    features: [],
    mustHaves: [],
    technicalPreference: [],
    deliveryCriteria: [],
    duration: "",
    budgetLimit: "",
    notes: [],
  };
}

export function parseSprintMessage(text) {
  const sprint = emptySprint();
  const warnings = [];
  let currentField = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || /^sprint baslat$/i.test(line) || /^sprint başlat$/i.test(line)) {
      continue;
    }

    const match = line.match(/^([^:]+):(.*)$/);
    if (match) {
      const key = FIELD_ALIASES.get(normalizeKey(match[1]));
      const value = match[2].trim();

      if (key) {
        currentField = key;
        if (MULTILINE_FIELDS.has(key)) {
          if (value) {
            sprint[key].push(cleanListLine(value));
          }
        } else {
          sprint[key] = value;
        }
        continue;
      }
    }

    if (currentField && MULTILINE_FIELDS.has(currentField)) {
      const value = cleanListLine(line);
      if (value) {
        sprint[currentField].push(value);
      }
      continue;
    }

    warnings.push(`Anlasilamayan satir: ${line}`);
  }

  if (!sprint.projectName) {
    sprint.projectName = "Yeni AI Agent Office Sprint";
    warnings.push("Proje adi eksik oldugu icin varsayilan baslik kullanildi.");
  }

  if (!sprint.goal) {
    warnings.push("Hedef alani eksik.");
  }

  if (sprint.features.length === 0) {
    warnings.push("Ana ozellikler alani bos.");
  }

  return {
    sprint,
    warnings,
  };
}

export function sprintToIssue(sprint, warnings = []) {
  const title = `[Sprint] ${sprint.projectName}`;
  const list = (items) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Belirtilmedi";

  const body = `# Sprint Intake

## Goal

${sprint.goal || "Belirtilmedi"}

## Target User

${sprint.userType || "Belirtilmedi"}

## Main Features

${list(sprint.features)}

## Must Haves

${list(sprint.mustHaves)}

## Technical Preference

${list(sprint.technicalPreference)}

## Delivery Criteria

${list(sprint.deliveryCriteria)}

## Duration

${sprint.duration || "Belirtilmedi"}

## Budget Limit

${sprint.budgetLimit || "Belirtilmedi"}

## Notes

${list(sprint.notes)}

## Planner Warnings

${list(warnings)}

## Definition of Done

- [ ] Tasks are split into agent-ready issues
- [ ] Code is pushed to a branch
- [ ] Pull request is opened
- [ ] Tests pass
- [ ] Demo URL is available
- [ ] Sprint report is prepared
`;

  return {
    title,
    body,
    labels: ["sprint-intake", "agent-office"],
  };
}

function taskTitle(projectName, index, item, type) {
  return `[Task] ${projectName} - ${String(index).padStart(2, "0")} ${type}: ${item}`;
}

function taskBody({ sprint, parentIssue, item, type, index }) {
  return `# Agent Task

Parent sprint: #${parentIssue.number}

## Goal

${item}

## Context

Project: ${sprint.projectName}
Sprint goal: ${sprint.goal || "Belirtilmedi"}
Target user: ${sprint.userType || "Belirtilmedi"}
Task type: ${type}
Task number: ${index}

## Acceptance Criteria

- [ ] Requirement is implemented or documented
- [ ] Related user flow is tested
- [ ] Result is linked back to parent sprint

## Test Plan

- [ ] Run relevant unit/integration tests
- [ ] Run smoke test for affected flow
- [ ] Add screenshots or demo notes when useful

## Definition of Done

- [ ] Code or document change is pushed
- [ ] Pull request or delivery note is linked
- [ ] Tests pass
- [ ] Known risks are documented
`;
}

export function sprintToTaskIssues(sprint, parentIssue) {
  const tasks = [];
  let index = 1;

  for (const feature of sprint.features) {
    tasks.push({
      title: taskTitle(sprint.projectName, index, feature, "Feature"),
      body: taskBody({
        sprint,
        parentIssue,
        item: feature,
        type: "Feature",
        index,
      }),
      labels: [],
    });
    index += 1;
  }

  for (const mustHave of sprint.mustHaves) {
    tasks.push({
      title: taskTitle(sprint.projectName, index, mustHave, "Requirement"),
      body: taskBody({
        sprint,
        parentIssue,
        item: mustHave,
        type: "Requirement",
        index,
      }),
      labels: [],
    });
    index += 1;
  }

  tasks.push({
    title: taskTitle(sprint.projectName, index, "QA smoke test and delivery report", "QA"),
    body: taskBody({
      sprint,
      parentIssue,
      item: "QA smoke test and delivery report",
      type: "QA",
      index,
    }),
    labels: [],
  });

  return tasks;
}

export function taskSummaryComment(parentIssue, taskIssues) {
  const taskList = taskIssues
    .map((issue) => `- [ ] #${issue.number} ${issue.title}`)
    .join("\n");

  return `# Project Task Breakdown

Sprint issue: #${parentIssue.number}

${taskList}

## Workflow

1. Each task issue should be implemented on its own branch.
2. Each completed task should link a PR, test result, or delivery note.
3. Parent sprint is done only after all task issues are closed.
`;
}
