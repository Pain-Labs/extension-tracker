import fs from "node:fs/promises";
import path from "node:path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendJsonl<T>(filePath: string, records: T[]): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await ensureParentDir(filePath);
  const lines = records.map((record) => `${JSON.stringify(record)}\n`).join("");
  await fs.appendFile(filePath, lines, "utf8");
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
