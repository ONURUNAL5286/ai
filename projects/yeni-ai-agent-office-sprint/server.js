import { createServer } from "node:http";
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
  const safePathname = decodeURIComponent(pathname).replace(/^[/\\]+/, "");
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
      console.log(`Port ${port} dolu, ${port + 1} deneniyor...`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Yeni AI Agent Office Sprint running at http://localhost:${port}`);
  });
}

listen(requestedPort);
