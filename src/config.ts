import fs from "node:fs/promises";
import { CONFIG_PATH } from "./paths.js";
import type { ExtensionConfig, Platform, SourceConfig } from "./types.js";

export async function loadExtensions(): Promise<ExtensionConfig[]> {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("config/extensions.json must contain an array");
  }

  return parsed.map((item, index) => {
    if (!isExtensionConfig(item)) {
      throw new Error(`Invalid extension config at index ${index}`);
    }
    return item;
  });
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isExtensionConfig(value: unknown): value is ExtensionConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.key === "string" &&
    optionalString(item.displayName) &&
    optionalString(item.repository) &&
    Array.isArray(item.urls) &&
    item.urls.every((url) => typeof url === "string")
  );
}

export function resolveSources(extensions: ExtensionConfig[]): SourceConfig[] {
  return extensions.flatMap((extension) => extension.urls.map((url) => parseSourceUrl(extension.key, url)));
}

function parseSourceUrl(key: string, rawUrl: string): SourceConfig {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();

  if (host === "marketplace.visualstudio.com") {
    const marketplaceId = url.searchParams.get("itemName");
    if (!marketplaceId) {
      throw new Error(`VS Code Marketplace URL missing itemName: ${rawUrl}`);
    }
    return { key, platform: "marketplace", url: rawUrl, marketplaceId };
  }

  if (host === "open-vsx.org") {
    const parts = url.pathname.split("/").filter(Boolean);
    const extensionIndex = parts[0] === "extension" ? 1 : parts[0] === "api" ? 1 : -1;
    const publisher = extensionIndex >= 0 ? parts[extensionIndex] : undefined;
    const name = extensionIndex >= 0 ? parts[extensionIndex + 1] : undefined;
    if (!publisher || !name) {
      throw new Error(`Open VSX URL must look like https://open-vsx.org/extension/<namespace>/<name>: ${rawUrl}`);
    }
    return { key, platform: "openvsx", url: rawUrl, publisher, name };
  }

  throw new Error(`Unsupported marketplace URL host: ${url.hostname}`);
}

export function platformsForSources(sources: SourceConfig[], platformFilter: Platform | null): SourceConfig[] {
  return platformFilter ? sources.filter((source) => source.platform === platformFilter) : sources;
}
