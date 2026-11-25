export const GITHUB_REPO = "dglds/gestor";
export const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string;
  checkedManually: boolean;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export function parseVersion(raw: string): [number, number, number] {
  const cleaned = raw.trim().replace(/^v/i, "").split("-")[0] ?? "";
  const parts = cleaned.split(".").map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function formatSimpleVersion(raw: string): string {
  const [major, minor, patch] = parseVersion(raw);
  return patch > 0 ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export async function checkForAppUpdate(
  currentVersion: string,
  checkedManually = false
): Promise<UpdateState> {
  const current = formatSimpleVersion(currentVersion);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        status: "up-to-date",
        currentVersion: current,
        latestVersion: current,
        releaseUrl: RELEASES_PAGE_URL,
        checkedManually,
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    if (!data.tag_name || data.draft || data.prerelease) {
      return {
        status: "up-to-date",
        currentVersion: current,
        latestVersion: current,
        releaseUrl: RELEASES_PAGE_URL,
        checkedManually,
      };
    }

    const latest = formatSimpleVersion(data.tag_name);
    const releaseUrl =
      data.html_url && data.html_url.startsWith(`https://github.com/${GITHUB_REPO}/`)
        ? data.html_url
        : RELEASES_PAGE_URL;

    if (isNewerVersion(latest, current)) {
      return {
        status: "available",
        currentVersion: current,
        latestVersion: latest,
        releaseUrl,
        checkedManually,
      };
    }

    return {
      status: "up-to-date",
      currentVersion: current,
      latestVersion: latest,
      releaseUrl,
      checkedManually,
    };
  } catch {
    return {
      status: "error",
      currentVersion: current,
      latestVersion: null,
      releaseUrl: RELEASES_PAGE_URL,
      checkedManually,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
