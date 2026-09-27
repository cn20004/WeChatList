import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function now() {
  return new Date().toISOString();
}

export class PersistentJobManager {
  constructor({ baseDir = "data/jobs" } = {}) {
    this.baseDir = path.resolve(baseDir);
    this.handlers = new Map();
    this.running = new Set();
    this.cancelled = new Set();
  }

  register(type, handler) {
    if (!type || typeof handler !== "function") {
      throw new Error("register(type, handler) requires a job type and handler");
    }
    this.handlers.set(type, handler);
    return this;
  }

  filePath(id) {
    return path.join(this.baseDir, `${id}.json`);
  }

  async ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async write(job) {
    await this.ensureDir();
    const target = this.filePath(job.id);
    const temp = `${target}.tmp`;
    await fs.writeFile(temp, JSON.stringify(job, null, 2), "utf8");
    await fs.rename(temp, target);
    return job;
  }

  async get(id) {
    try {
      return JSON.parse(await fs.readFile(this.filePath(id), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async list({ limit = 100 } = {}) {
    await this.ensureDir();
    const names = (await fs.readdir(this.baseDir))
      .filter(name => name.endsWith(".json"));

    const jobs = [];
    for (const name of names) {
      try {
        jobs.push(JSON.parse(await fs.readFile(path.join(this.baseDir, name), "utf8")));
      } catch {}
    }

    return jobs
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, Math.max(1, Number(limit) || 100));
  }

  async create(type, payload = {}) {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    const timestamp = now();
    const job = {
      id: randomUUID(),
      type,
      status: "queued",
      payload,
      progress: {
        stage: "queued",
        current: 0,
        total: null,
        percent: 0,
        message: ""
      },
      result: null,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null
    };

    await this.write(job);
    queueMicrotask(() => {
      this.run(job.id).catch(() => {});
    });
    return job;
  }

  async update(id, patch = {}) {
    const job = await this.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    const next = {
      ...job,
      ...patch,
      updatedAt: now()
    };

    await this.write(next);
    return next;
  }

  async updateProgress(id, progress = {}) {
    const job = await this.get(id);
    if (!job) return null;

    const current = Number(progress.current ?? job.progress?.current ?? 0);
    const totalValue = progress.total ?? job.progress?.total ?? null;
    const total = totalValue == null ? null : Number(totalValue);
    const percent = total && total > 0
      ? Math.min(100, Math.round((current / total) * 100))
      : Number(progress.percent ?? job.progress?.percent ?? 0);

    return this.update(id, {
      progress: {
        ...job.progress,
        ...progress,
        current,
        total,
        percent
      }
    });
  }

  async cancel(id) {
    const job = await this.get(id);
    if (!job) return null;

    this.cancelled.add(id);

    if (job.status === "queued") {
      return this.update(id, {
        status: "cancelled",
        completedAt: now(),
        progress: {
          ...job.progress,
          stage: "cancelled",
          message: "Cancelled before execution"
        }
      });
    }

    return this.update(id, {
      progress: {
        ...job.progress,
        message: "Cancellation requested"
      }
    });
  }

  isCancelled(id) {
    return this.cancelled.has(id);
  }

  async run(id) {
    if (this.running.has(id)) return this.get(id);

    let job = await this.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    if (["completed", "cancelled"].includes(job.status)) return job;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      return this.update(id, {
        status: "failed",
        error: `No handler registered for job type: ${job.type}`,
        completedAt: now()
      });
    }

    this.running.add(id);

    try {
      job = await this.update(id, {
        status: "running",
        startedAt: job.startedAt || now(),
        error: null,
        progress: {
          ...job.progress,
          stage: "starting",
          message: "Job started"
        }
      });

      const result = await handler(job.payload, {
        jobId: id,
        updateProgress: progress => this.updateProgress(id, progress),
        isCancelled: () => this.isCancelled(id)
      });

      if (this.isCancelled(id)) {
        return this.update(id, {
          status: "cancelled",
          result,
          completedAt: now(),
          progress: {
            ...(await this.get(id))?.progress,
            stage: "cancelled",
            message: "Cancelled"
          }
        });
      }

      return this.update(id, {
        status: "completed",
        result,
        completedAt: now(),
        progress: {
          ...(await this.get(id))?.progress,
          stage: "completed",
          percent: 100,
          message: "Completed"
        }
      });
    } catch (error) {
      return this.update(id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: now(),
        progress: {
          ...(await this.get(id))?.progress,
          stage: "failed",
          message: error instanceof Error ? error.message : String(error)
        }
      });
    } finally {
      this.running.delete(id);
      this.cancelled.delete(id);
    }
  }

  async retry(id) {
    const job = await this.get(id);
    if (!job) return null;

    const reset = await this.update(id, {
      status: "queued",
      result: null,
      error: null,
      completedAt: null,
      progress: {
        stage: "queued",
        current: 0,
        total: null,
        percent: 0,
        message: "Queued for retry"
      }
    });

    queueMicrotask(() => {
      this.run(id).catch(() => {});
    });

    return reset;
  }

  async resumeInterrupted() {
    const jobs = await this.list({ limit: 10000 });
    const resumable = jobs.filter(job => ["queued", "running"].includes(job.status));

    for (const job of resumable) {
      await this.update(job.id, {
        status: "queued",
        progress: {
          ...job.progress,
          stage: "queued",
          message: "Resumed after service restart"
        }
      });

      queueMicrotask(() => {
        this.run(job.id).catch(() => {});
      });
    }

    return resumable.length;
  }
}
