import path from "node:path";
import type { Platform } from "./types.js";

export const ROOT_DIR = process.cwd();
export const CONFIG_PATH = path.join(ROOT_DIR, "config", "extensions.json");
export const OUTPUT_DIR = path.join(ROOT_DIR, "output");
export const DATA_DIR = path.join(OUTPUT_DIR, "data");
export const CHARTS_DIR = path.join(OUTPUT_DIR, "charts");

export function dataFilePath(extensionId: string, platform: Platform): string {
  return path.join(DATA_DIR, `${safeSeriesName(extensionId, platform)}.jsonl`);
}

export function safeSeriesName(extensionId: string, platform: Platform): string {
  return `${extensionId}-${platform}`.replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}
