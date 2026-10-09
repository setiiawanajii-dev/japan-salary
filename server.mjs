import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("./dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const p = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!p.startsWith(root)) throw Error();
    const data = await readFile(p);
    res.writeHead(200, {
      "Content-Type": types[path.extname(p)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log("Local: http://127.0.0.1:" + server.address().port),
);
