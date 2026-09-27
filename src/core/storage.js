import fs from "node:fs/promises";
import path from "node:path";
import { exportArticle, getSuggestedFilename } from "./exporter.js";

function sanitizeSegment(value = "untitled") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "untitled";
}

export class FileStorage {
  constructor({ baseDir = "data" } = {}) {
    this.baseDir = path.resolve(baseDir);
  }

  async saveArticle(article, { format = "json", directory = "articles" } = {}) {
    const exported = exportArticle(article, format);
    const folder = path.join(this.baseDir, sanitizeSegment(directory));
    await fs.mkdir(folder, { recursive: true });

    const filename = getSuggestedFilename(article, exported.extension);
    const filePath = path.join(folder, filename);
    await fs.writeFile(filePath, exported.content, "utf8");

    return {
      filePath,
      filename,
      format: exported.extension
    };
  }
}
