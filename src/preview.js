import { createServer } from "node:http";
import { stat, readFile, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const requestedPort = Number(process.env.PREVIEW_PORT || 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fileMtime(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return 0;
  }
}

async function projectEntries() {
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const projects = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const projectPath = join(projectsRoot, entry.name);
    const publicIndex = join(projectPath, "public", "index.html");
    if ((await fileMtime(publicIndex)) === 0) {
      continue;
    }

    projects.push({
      slug: entry.name,
      path: projectPath,
      mtime: Math.max(
        await fileMtime(publicIndex),
        await fileMtime(join(projectPath, "AGENT_BOARD.md")),
        await fileMtime(join(projectPath, "STATUS.md")),
      ),
    });
  }

  return projects.sort((left, right) => right.mtime - left.mtime);
}

async function latestProject() {
  return (await projectEntries())[0] ?? null;
}

function safeProjectPath(project, requestPath) {
  const relativePath = decodeURIComponent(requestPath).replace(/^\/project\/[^/]+\/?/, "") || "index.html";
  const cleanPath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const publicRoot = join(project.path, "public");
  const target = join(publicRoot, cleanPath);
  return target.startsWith(publicRoot) ? target : join(publicRoot, "index.html");
}

async function serveProject(project, request, response) {
  const url = new URL(request.url, "http://localhost");
  const target = safeProjectPath(project, url.pathname);
  const content = await readFile(target).catch(() => null);

  if (!content) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Dosya bulunamadi.");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  response.end(content);
}

async function serveIndex(response) {
  const projects = await projectEntries();
  const current = projects[0];

  if (!current) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<h1>Henuz proje yok</h1>");
    return;
  }

  response.writeHead(302, { Location: `/project/${current.slug}/` });
  response.end();
}

async function serveProjectList(response) {
  const projects = await projectEntries();
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Preview</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #f5f7fa; color: #17202a; }
      main { max-width: 820px; margin: 0 auto; padding: 24px; }
      a { display: block; background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px 16px; margin: 10px 0; color: #17202a; text-decoration: none; }
      span { color: #667487; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Project Preview</h1>
      ${projects.map((project) => `<a href="/project/${escapeHtml(project.slug)}/"><strong>${escapeHtml(project.slug)}</strong><br><span>Tek preview ekraninda ac</span></a>`).join("")}
    </main>
  </body>
</html>`);
}

function listen(port) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (url.pathname === "/") {
        await serveIndex(response);
        return;
      }

      if (url.pathname === "/projects") {
        await serveProjectList(response);
        return;
      }

      const match = url.pathname.match(/^\/project\/([^/]+)\/?/);
      if (match) {
        const slug = decodeURIComponent(match[1]);
        const project = (await projectEntries()).find((item) => item.slug === slug);
        if (project) {
          await serveProject(project, request, response);
          return;
        }
      }

      const current = await latestProject();
      if (current) {
        await serveProject(current, request, response);
        return;
      }

      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Proje bulunamadi.");
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
  });

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Preview port ${port} dolu, ${port + 1} deneniyor...`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, async () => {
    const current = await latestProject();
    const suffix = current ? `, aktif proje: ${current.slug}` : "";
    console.log(`Project Preview running at http://localhost:${port}${suffix}`);
  });
}

listen(requestedPort);
