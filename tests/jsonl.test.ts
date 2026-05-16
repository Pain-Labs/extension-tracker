import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendJsonl, readJsonl, writeJson } from "../src/storage/jsonl.js";

describe("jsonl storage", () => {
  it("appends and reads newline-delimited JSON", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "extension-tracker-"));
    const filePath = path.join(dir, "data", "snapshots.jsonl");

    await appendJsonl(filePath, [{ id: 1 }, { id: 2 }]);

    await expect(readJsonl<{ id: number }>(filePath)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns an empty array for a missing file", async () => {
    const filePath = path.join(os.tmpdir(), "extension-tracker-missing.jsonl");
    await expect(readJsonl(filePath)).resolves.toEqual([]);
  });

  it("writes formatted JSON", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "extension-tracker-"));
    const filePath = path.join(dir, "data", "latest.json");

    await writeJson(filePath, { ok: true });

    await expect(fs.readFile(filePath, "utf8")).resolves.toContain('"ok": true');
  });
});
