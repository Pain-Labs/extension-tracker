import { fetchJsonWithRetry } from "../http.js";
import type { Snapshot, SourceConfig } from "../types.js";

export async function fetchOpenVsxSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  if (!source.publisher || !source.name) {
    throw new Error(`Open VSX source missing namespace/name for ${source.key}`);
  }

  const url = `https://open-vsx.org/api/${encodeURIComponent(source.publisher)}/${encodeURIComponent(source.name)}`;
  const response = await fetchJsonWithRetry(url);

  if (!response || typeof response !== "object") {
    throw new Error("Open VSX response is not an object");
  }

  const body = response as Record<string, unknown>;

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "openvsx",
    extension_id: source.key,
    version: readRequiredString(body.version, "version"),
    install_count: null,
    download_count: readOptionalNumber(body.downloadCount),
    avg_rating: readOptionalNumber(body.averageRating),
    rating_count: readOptionalNumber(body.reviewCount),
  };
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Open VSX response missing ${fieldName}`);
  }
  return value;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
