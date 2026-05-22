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

export function sprintToIssue(sprint, warnings = [], context = null) {
  const title = `[Sprint] ${sprint.projectName}`;
  const list = (items) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Belirtilmedi";

  const projectSection = context
    ? `## Repository Project

- Project folder: \`${context.projectPath}\`
- Sprint file: \`${context.sprintPath}\`
- Task checklist: \`${context.taskPath}\`

`
    : "";

  const body = `# Sprint Intake: ${sprint.projectName}

${projectSection}
## Status

- [ ] Project files created in repo
- [ ] Agent task issues created
- [ ] Implementation completed
- [ ] Tests passed
- [ ] Demo verified
- [ ] Delivery report prepared

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

- [ ] All child task issues are closed
- [ ] Project runs locally from its own folder
- [ ] Test or smoke-test evidence is linked
- [ ] Final delivery notes are added to this sprint
`;

  return {
    title,
    body,
    labels: ["sprint-intake", "agent-office"],
  };
}

function taskTitle(projectName, index, item, role) {
  return `[${projectName}] ${String(index).padStart(2, "0")} ${role}: ${item}`;
}

function taskBody({ sprint, parentIssue, item, role, index, context }) {
  return `# ${role} Task

## Links

- Parent sprint: #${parentIssue.number}
- Project folder: \`${context.projectPath}\`
- Sprint file: \`${context.sprintPath}\`
- Task checklist: \`${context.taskPath}\`

## Goal

${item}

## Context

Project: ${sprint.projectName}
Sprint goal: ${sprint.goal || "Belirtilmedi"}
Target user: ${sprint.userType || "Belirtilmedi"}
Agent role: ${role}
Task number: ${index}

## Acceptance Criteria

- [ ] Scope is completed inside \`${context.projectPath}\`
- [ ] Related user flow or document is updated
- [ ] Result is linked back to parent sprint #${parentIssue.number}
- [ ] No unrelated project folder is changed

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

export function sprintToTaskIssues(sprint, parentIssue, context) {
  const tasks = [];
  let index = 1;

  for (const feature of sprint.features) {
    tasks.push({
      title: taskTitle(sprint.projectName, index, feature, "Frontend/Backend"),
      body: taskBody({
        sprint,
        parentIssue,
        item: feature,
        role: "Frontend/Backend",
        index,
        context,
      }),
      labels: [],
    });
    index += 1;
  }

  for (const mustHave of sprint.mustHaves) {
    tasks.push({
      title: taskTitle(sprint.projectName, index, mustHave, "Product/QA"),
      body: taskBody({
        sprint,
        parentIssue,
        item: mustHave,
        role: "Product/QA",
        index,
        context,
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
      role: "QA",
      index,
      context,
    }),
    labels: [],
  });

  return tasks;
}

export function taskSummaryComment(parentIssue, taskIssues, context) {
  const taskList = taskIssues
    .map((issue) => `- [ ] #${issue.number} ${issue.title}`)
    .join("\n");

  return `# Project Task Breakdown

Sprint issue: #${parentIssue.number}

Project folder: \`${context.projectPath}\`
Sprint file: \`${context.sprintPath}\`
Task checklist: \`${context.taskPath}\`

${taskList}

## Workflow

1. Work only inside the listed project folder.
2. Each task issue should be implemented on its own branch.
3. Each completed task should link a PR, test result, or delivery note.
4. Parent sprint is done only after all task issues are closed.
`;
}
