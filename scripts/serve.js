import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.argv[2] || "."),
  port = Number(process.env.PORT || 4173);
http
  .createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(root, "." + name);
      if (!file.startsWith(root + path.sep) && file !== root)
        throw Error("path");
      let target = (await stat(file)).isDirectory()
        ? path.join(file, "index.html")
        : file;
      let data = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "text/javascript",
            ".png": "image/png",
          }[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
