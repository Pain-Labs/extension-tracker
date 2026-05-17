import { fetchJsonWithRetry } from "../http.js";
import type { Snapshot, SourceConfig } from "../types.js";

export async function fetchMultiEcosystemSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  switch (source.platform) {
    case "firefox":
      return fetchFirefoxSnapshot(source, snapshotDate, fetchedAt);
    case "jetbrains":
      return fetchJetBrainsSnapshot(source, snapshotDate, fetchedAt);
    case "npm":
      return fetchNpmSnapshot(source, snapshotDate, fetchedAt);
    case "docker":
      return fetchDockerSnapshot(source, snapshotDate, fetchedAt);
    case "github":
      return fetchGithubSnapshot(source, snapshotDate, fetchedAt);
    default:
      throw new Error(`Unsupported platform: ${source.platform}`);
  }
}

// ── 1. Mozilla Add-ons (Official JSON API) ────────────────────────────
async function fetchFirefoxSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(source.name || source.key)}/`;
  const response = await fetchJsonWithRetry(url) as Record<string, unknown>;

  const rating = response.ratings as Record<string, unknown> | undefined;
  const currentVersion = response.current_version as Record<string, unknown> | undefined;

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "firefox",
    extension_id: source.key,
    version: currentVersion && typeof currentVersion.version === "string" ? currentVersion.version : "latest",
    install_count: typeof response.average_daily_users === "number" ? response.average_daily_users : null,
    download_count: typeof response.average_daily_users === "number" ? response.average_daily_users : null,
    avg_rating: rating && typeof rating.average === "number" ? rating.average : null,
    rating_count: rating && typeof rating.count === "number" ? rating.count : null,
  };
}

// ── 2. JetBrains Marketplace (Official JSON API) ──────────────────────
async function fetchJetBrainsSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  const url = `https://plugins.jetbrains.com/api/plugins/${encodeURIComponent(source.marketplaceId || "")}`;
  const response = await fetchJsonWithRetry(url) as Record<string, unknown>;

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "jetbrains",
    extension_id: source.key,
    version: "latest",
    install_count: typeof response.downloads === "number" ? response.downloads : null,
    download_count: typeof response.downloads === "number" ? response.downloads : null,
    avg_rating: typeof response.rating === "number" ? response.rating : null,
    rating_count: null,
  };
}

// ── 3. npm Registry (Official Downloads & Package APIs) ───────────────
async function fetchNpmSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  if (!source.name) {
    throw new Error(`npm source missing package name for ${source.key}`);
  }

  const dlUrl = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(source.name)}`;
  const dlResponse = await fetchJsonWithRetry(dlUrl) as Record<string, unknown>;

  let version = "latest";
  try {
    const pkgUrl = `https://registry.npmjs.org/${encodeURIComponent(source.name)}/latest`;
    const pkgResponse = await fetchJsonWithRetry(pkgUrl) as Record<string, unknown>;
    if (typeof pkgResponse.version === "string") version = pkgResponse.version;
  } catch {
    console.warn(`[npm] Failed to fetch latest version for ${source.key}`);
  }

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "npm",
    extension_id: source.key,
    version,
    install_count: typeof dlResponse.downloads === "number" ? dlResponse.downloads : null,
    download_count: typeof dlResponse.downloads === "number" ? dlResponse.downloads : null,
    avg_rating: null,
    rating_count: null,
  };
}

// ── 4. Docker Hub (Official Repositories API) ─────────────────────────
async function fetchDockerSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  if (!source.publisher || !source.name) {
    throw new Error(`Docker Hub source missing namespace/name for ${source.key}`);
  }

  const url = `https://hub.docker.com/v2/repositories/${encodeURIComponent(source.publisher)}/${encodeURIComponent(source.name)}/`;
  const response = await fetchJsonWithRetry(url) as Record<string, unknown>;

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "docker",
    extension_id: source.key,
    version: "latest",
    install_count: typeof response.pull_count === "number" ? response.pull_count : null,
    download_count: typeof response.pull_count === "number" ? response.pull_count : null,
    avg_rating: null,
    rating_count: null,
  };
}

// ── 5. GitHub Releases (Official Repo & Releases APIs) ────────────────
async function fetchGithubSnapshot(
  source: SourceConfig,
  snapshotDate: string,
  fetchedAt: string,
): Promise<Snapshot> {
  if (!source.publisher || !source.name) {
    throw new Error(`GitHub source missing owner/repo for ${source.key}`);
  }

  const githubHeaders: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Extension-Tracker",
  };
  if (process.env.GITHUB_TOKEN) {
    githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(source.publisher)}/${encodeURIComponent(source.name)}/releases`;
  const response = await fetchJsonWithRetry(url, { headers: githubHeaders }) as Array<Record<string, unknown>>;

  let totalDownloads = 0;
  let latestTagName = "latest";

  if (Array.isArray(response)) {
    if (response[0] && typeof response[0].tag_name === "string") {
      latestTagName = response[0].tag_name;
    }
    for (const release of response) {
      if (release && Array.isArray(release.assets)) {
        for (const asset of release.assets) {
          if (asset && typeof asset.download_count === "number") {
            totalDownloads += asset.download_count;
          }
        }
      }
    }
  }

  return {
    snapshot_date: snapshotDate,
    fetched_at: fetchedAt,
    platform: "github",
    extension_id: source.key,
    version: latestTagName,
    install_count: totalDownloads,
    download_count: totalDownloads,
    avg_rating: null,
    rating_count: null,
  };
}
