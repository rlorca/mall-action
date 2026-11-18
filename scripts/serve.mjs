import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const port = Number(process.env.PORT || 4173);
http
  .createServer(async (req, res) => {
    const file = path.resolve(
      ".",
      "." +
        new URL(req.url, "http://local").pathname.replace(/\/$/, "/index.html"),
    );
    if (!file.startsWith(process.cwd() + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".png")
              ? "image/png"
              : "text/plain",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log("Mall open on http://127.0.0.1:" + port),
  );
