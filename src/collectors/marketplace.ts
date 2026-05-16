import { fetchJsonWithRetry } from "../http.js";
import type { Snapshot, SourceConfig } from "../types.js";

const MARKETPLACE_URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

export async function fetchMarketplaceSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  if (!source.marketplaceId) {
    throw new Error(`Marketplace source missing marketplaceId for ${source.key}`);
  }

  const response = await fetchJsonWithRetry(MARKETPLACE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json; charset=utf-8; api-version=7.2-preview.1",
    },
    body: JSON.stringify({
      filters: [
        {
          criteria: [{ filterType: 7, value: source.marketplaceId }],
        },
      ],
      flags: 16863,
    }),
  });

  const galleryExtension = readMarketplaceExtension(response, source.marketplaceId);
  const latestVersion = readFirstObject(galleryExtension.versions, "versions");
  const statistics = Array.isArray(galleryExtension.statistics) ? galleryExtension.statistics : [];

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "marketplace",
    extension_id: source.key,
    version: readString(latestVersion.version, "version"),
    install_count: readStatistic(statistics, "install"),
    download_count: readStatistic(statistics, "downloadCount"),
    avg_rating: readStatistic(statistics, "averagerating"),
    rating_count: readStatistic(statistics, "ratingcount"),
  };
}

function readMarketplaceExtension(value: unknown, extensionId: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Marketplace response is not an object");
  }

  const results = (value as Record<string, unknown>).results;
  const firstResult = readFirstObject(results, "results");
  const extensions = firstResult.extensions;
  const firstExtension = readFirstObject(extensions, "extensions");

  if (typeof firstExtension.extensionName !== "string" && typeof firstExtension.extensionId !== "string") {
    throw new Error(`Marketplace response did not include extension metadata for ${extensionId}`);
  }

  return firstExtension;
}

function readFirstObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!Array.isArray(value) || !value[0] || typeof value[0] !== "object") {
    throw new Error(`Marketplace response missing ${fieldName}[0]`);
  }
  return value[0] as Record<string, unknown>;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Marketplace response missing ${fieldName}`);
  }
  return value;
}

function readStatistic(statistics: unknown[], name: string): number | null {
  const item = statistics.find((statistic) => {
    if (!statistic || typeof statistic !== "object") {
      return false;
    }
    return (statistic as Record<string, unknown>).statisticName === name;
  });

  if (!item || typeof item !== "object") {
    return null;
  }

  const value = (item as Record<string, unknown>).value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
