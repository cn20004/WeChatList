import fs from "node:fs/promises";
import path from "node:path";

export class SessionStore {
  constructor({ filePath = "data/session.json" } = {}) {
    this.filePath = path.resolve(filePath);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw);
      return {
        cookie: String(data.cookie || ""),
        token: String(data.token || ""),
        savedAt: data.savedAt || null
      };
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async save({ cookie, token }) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const data = {
      cookie: String(cookie || ""),
      token: String(token || ""),
      savedAt: new Date().toISOString()
    };
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
    return data;
  }
}
