import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PersistentJobManager } from "../src/core/job-manager.js";

test("persistent job manager completes and stores result", async () => {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "wechat-jobs-"));
  const manager = new PersistentJobManager({ baseDir });

  manager.register("echo", async (payload, context) => {
    await context.updateProgress({
      stage: "working",
      current: 1,
      total: 1,
      message: "done"
    });
    return { value: payload.value };
  });

  const job = await manager.create("echo", { value: 42 });

  let final = null;
  for (let i = 0; i < 50; i += 1) {
    final = await manager.get(job.id);
    if (["completed", "failed"].includes(final.status)) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  assert.equal(final.status, "completed");
  assert.deepEqual(final.result, { value: 42 });
  assert.equal(final.progress.percent, 100);
});

test("persistent job manager can cancel queued job", async () => {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "wechat-jobs-"));
  const manager = new PersistentJobManager({ baseDir });

  manager.register("slow", async (_payload, context) => {
    while (!context.isCancelled()) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return { cancelled: true };
  });

  const job = await manager.create("slow", {});
  await manager.cancel(job.id);

  let final = null;
  for (let i = 0; i < 50; i += 1) {
    final = await manager.get(job.id);
    if (["cancelled", "completed", "failed"].includes(final.status)) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  assert.equal(final.status, "cancelled");
});
