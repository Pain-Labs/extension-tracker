import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../src/paths.js";
import { readJsonl } from "../src/storage/jsonl.js";
import type { Snapshot } from "../src/types.js";

const args = process.argv.slice(2);

async function main(): Promise<void> {
  const command = args[0];

  switch (command) {
    case "latest":
      await latest();
      break;
    case "trend":
      await trend(args[1], readDays(args, 30));
      break;
    case "releases":
      await releases(args[1]);
      break;
    case "export":
      await exportSnapshots(readOutput(args));
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

async function latest(): Promise<void> {
  const snapshots = await readAllSnapshots();
  const latestByKey = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.extension_id}\t${snapshot.platform}`;
    const previous = latestByKey.get(key);
    if (!previous || previous.fetched_at < snapshot.fetched_at) {
      latestByKey.set(key, snapshot);
    }
  }
  console.table(Array.from(latestByKey.values()).map(formatSnapshot));
}

async function trend(extensionId: string | undefined, days: number): Promise<void> {
  if (!extensionId) {
    throw new Error("trend requires an extension id");
  }

  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const snapshots = (await readAllSnapshots())
    .filter((snapshot) => snapshot.extension_id === extensionId)
    .filter((snapshot) => new Date(`${snapshot.snapshot_date}T00:00:00.000Z`).getTime() >= since)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date) || a.platform.localeCompare(b.platform));

  console.table(snapshots.map(formatSnapshot));
}

async function releases(extensionId: string | undefined): Promise<void> {
  if (!extensionId) {
    throw new Error("releases requires an extension id");
  }

  const snapshots = (await readAllSnapshots())
    .filter((snapshot) => snapshot.extension_id === extensionId)
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.snapshot_date.localeCompare(b.snapshot_date));
  const changes = snapshots.flatMap((snapshot, index, list) => {
    const previous = list.slice(0, index).reverse().find((candidate) => candidate.platform === snapshot.platform);
    if (!previous || previous.version === snapshot.version) {
      return [];
    }
    return [{
      detected_at: snapshot.fetched_at,
      platform: snapshot.platform,
      extension_id: snapshot.extension_id,
      old_version: previous.version,
      new_version: snapshot.version,
    }];
  });

  console.table(changes);
}

async function exportSnapshots(outputPath: string | null): Promise<void> {
  const snapshots = await readAllSnapshots();
  const csv = [
    "snapshot_date,fetched_at,platform,extension_id,version,install_count,download_count,avg_rating,rating_count",
    ...snapshots.map((snapshot) => [
      snapshot.snapshot_date,
      snapshot.fetched_at,
      snapshot.platform,
      snapshot.extension_id,
      snapshot.version,
      snapshot.install_count ?? "",
      snapshot.download_count ?? "",
      snapshot.avg_rating ?? "",
      snapshot.rating_count ?? "",
    ].map(csvCell).join(",")),
  ].join("\n");

  if (outputPath) {
    await fs.writeFile(outputPath, `${csv}\n`, "utf8");
  } else {
    console.log(csv);
  }
}

async function readAllSnapshots(): Promise<Snapshot[]> {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => path.join(DATA_DIR, entry.name));
  const groups = await Promise.all(files.map((file) => readJsonl<Snapshot>(file)));
  return groups.flat();
}

function formatSnapshot(snapshot: Snapshot): Record<string, string | number | null> {
  return {
    date: snapshot.snapshot_date,
    platform: snapshot.platform,
    extension: snapshot.extension_id,
    version: snapshot.version,
    installs: snapshot.install_count,
    downloads: snapshot.download_count,
    rating: snapshot.avg_rating,
    ratings: snapshot.rating_count,
  };
}

function readDays(values: string[], fallback: number): number {
  const index = values.indexOf("--days");
  if (index < 0) {
    return fallback;
  }

  const parsed = Number(values[index + 1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readOutput(values: string[]): string | null {
  const index = values.indexOf("--output");
  if (index >= 0) {
    return values[index + 1] ?? null;
  }

  const positional = values[1];
  return positional && !positional.startsWith("--") ? positional : null;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function printUsage(): void {
  console.log(`Usage:
  npm run query -- latest
  npm run query -- trend <extension-id> --days 30
  npm run query -- releases <extension-id>
  npm run query -- export snapshots.csv`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
