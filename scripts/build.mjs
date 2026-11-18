import { mkdir, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "src", "splash"])
  await cp(file, "dist/" + file, { recursive: true });
