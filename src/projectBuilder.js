function slugify(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "new-project";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(items) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Belirtilmedi";
}

function checklist(items) {
  return items.length > 0 ? items.map((item) => `- [ ] ${item}`).join("\n") : "- [ ] Belirtilmedi";
}

export function createProjectContext(sprint, now = new Date()) {
  const projectSlug = slugify(sprint.projectName);
  const sprintId = `sprint-${now.toISOString().replace(/[-:]/g, "").slice(0, 13)}`;
  const projectPath = `projects/${projectSlug}`;

  return {
    projectSlug,
    sprintId,
    projectPath,
    sprintPath: `${projectPath}/sprints/${sprintId}.md`,
    taskPath: `${projectPath}/tasks/${sprintId}-tasks.md`,
  };
}

export function buildProjectFiles(sprint, context) {
  const featureCards = sprint.features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("\n");
  const mustHaveCards = sprint.mustHaves
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  return [
    {
      path: `${context.projectPath}/README.md`,
      content: `# ${sprint.projectName}

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli ` +
        "`projects/<proje-adi>`" +
        ` klasorlerinde tutulur.

## Goal

${sprint.goal || "Belirtilmedi"}

## Target User

${sprint.userType || "Belirtilmedi"}

## Run

Windows'ta en kolay calistirma:

~~~powershell
.\start.cmd
~~~

PowerShell ile:

~~~powershell
.\start.ps1
~~~

Alternatif:

~~~powershell
npm.cmd start
~~~

Sunucu bos portu otomatik secer. Terminalde su satiri ara:

~~~text
${sprint.projectName} running at http://localhost:<port>
~~~

Sonra tarayicida terminalde yazan URL'yi ac.

## Project Structure

- public/index.html: Calisan ilk demo ekran.
- server.js: Basit statik dosya sunucusu.
- start.cmd: Windows icin tek komutla baslatma.
- start.ps1: PowerShell icin tek komutla baslatma.
- sprints/: Bu projeye ait sprint planlari.
- tasks/: Bu projeye ait agent task listeleri.
`,
    },
    {
      path: `${context.projectPath}/package.json`,
      content: JSON.stringify(
        {
          name: context.projectSlug,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            start: "node server.js",
          },
        },
        null,
        2,
      ) + "\n",
    },
    {
      path: `${context.projectPath}/server.js`,
      content: `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const requestedPort = Number(process.env.PORT || 3000);
const root = fileURLToPath(new URL("./public/", import.meta.url));
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

function createAppServer() {
  return createServer(async (request, response) => {
  const pathname = request.url === "/" ? "/index.html" : request.url;
  const safePathname = decodeURIComponent(pathname).replace(/^[/\\\\]+/, "");
  const filePath = join(root, safePathname);

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
  });
}

function listen(port) {
  const server = createAppServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(\`Port \${port} dolu, \${port + 1} deneniyor...\`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(\`${sprint.projectName} running at http://localhost:\${port}\`);
  });
}

listen(requestedPort);
`,
    },
    {
      path: `${context.projectPath}/start.cmd`,
      content: `@echo off
setlocal
cd /d "%~dp0"
node server.js
pause
`,
    },
    {
      path: `${context.projectPath}/start.ps1`,
      content: `Set-Location $PSScriptRoot
node server.js
`,
    },
    {
      path: `${context.projectPath}/public/index.html`,
      content: `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(sprint.projectName)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7f9;
        color: #17202a;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      header {
        border-bottom: 1px solid #d9dee7;
        padding-bottom: 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 36px;
        line-height: 1.1;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 20px;
      }
      p {
        max-width: 760px;
        line-height: 1.6;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      section {
        background: #ffffff;
        border: 1px solid #d9dee7;
        border-radius: 8px;
        padding: 20px;
      }
      li {
        margin: 8px 0;
      }
      code {
        background: #eef1f5;
        border-radius: 4px;
        padding: 2px 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(sprint.projectName)}</h1>
        <p>${escapeHtml(sprint.goal || "Sprint hedefi belirtilmedi.")}</p>
      </header>
      <div class="grid">
        <section>
          <h2>Hedef Kullanici</h2>
          <p>${escapeHtml(sprint.userType || "Belirtilmedi")}</p>
        </section>
        <section>
          <h2>Ana Ozellikler</h2>
          <ul>
            ${featureCards || "<li>Belirtilmedi</li>"}
          </ul>
        </section>
        <section>
          <h2>Olmazsa Olmazlar</h2>
          <ul>
            ${mustHaveCards || "<li>Belirtilmedi</li>"}
          </ul>
        </section>
        <section>
          <h2>Teslim</h2>
          <p>Bu proje AI Agent Office tarafindan <code>${context.sprintId}</code> sprintinden olusturuldu.</p>
        </section>
      </div>
    </main>
  </body>
</html>
`,
    },
    {
      path: context.sprintPath,
      content: `# ${context.sprintId} - ${sprint.projectName}

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
`,
    },
    {
      path: context.taskPath,
      content: `# Agent Task Checklist - ${context.sprintId}

## Feature Tasks

${checklist(sprint.features)}

## Requirement Tasks

${checklist(sprint.mustHaves)}

## Delivery Tasks

- [ ] QA smoke test tamamla
- [ ] Demo calistirma notunu ekle
- [ ] GitHub issue/PR linklerini guncelle
- [ ] Sprint raporunu hazirla
`,
    },
  ];
}
