import { Hono, type Context } from "hono";
import { stream } from "hono/streaming";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import type { AppEnv } from "../lib/types.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { getProject } from "../db/queries.js";
import {
  packageJsonTemplate,
  viteConfigTemplate,
  tsconfigTemplate,
  readmeTemplate,
} from "./export-templates.js";

const exportRoute = new Hono<AppEnv>();

async function getAuthorizedProject(c: Context<AppEnv>, projectId: string) {
  const sql = c.get("sql");
  const userId = c.get("userId");
  const project = await getProject(sql, projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.user_id !== userId) throw new ForbiddenError();
  return project;
}

exportRoute.post("/:id/export", async (c) => {
  const project = await getAuthorizedProject(c, c.req.param("id"));
  const fileTree = project.file_tree;

  // Determine if files should go at root or under src/
  const hasRootFiles =
    "manifest.json" in fileTree || "index.html" in fileTree;

  const archive = archiver("zip", { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  // Add scaffold files
  archive.append(packageJsonTemplate(project.name), {
    name: "package.json",
  });
  archive.append(viteConfigTemplate, { name: "vite.config.ts" });
  archive.append(tsconfigTemplate, { name: "tsconfig.json" });
  archive.append(readmeTemplate(project.name), { name: "README.md" });

  // Add source files
  for (const [filePath, content] of Object.entries(fileTree)) {
    const archivePath = hasRootFiles ? filePath : `src/${filePath}`;
    archive.append(content, { name: archivePath });
  }

  archive.finalize();

  c.header("Content-Type", "application/zip");
  c.header(
    "Content-Disposition",
    `attachment; filename="${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`
  );

  return stream(c, async (s) => {
    const reader = passThrough;
    for await (const chunk of reader) {
      await s.write(chunk as Uint8Array);
    }
  });
});

export default exportRoute;
