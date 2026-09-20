import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { INSTALL_ROOT } from "./paths";

export const RELEASE_ORIGIN =
  process.env.TERMINAL_BROWSER_RELEASE_ORIGIN ?? "https://terminal-browser.sh/install";

const releasePlatformSchema = z.object({
  file: z.string(),
  sha256: z.string(),
  size: z.number(),
  url: z.string(),
});

const releaseManifestSchema = z.object({
  version: z.string().min(1),
  channel: z.string().min(1),
  install: z.string().min(1),
  platforms: z.record(z.string(), releasePlatformSchema).optional(),
});

export type ReleasePlatform = z.infer<typeof releasePlatformSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export function distRoot(): string | null {
  return INSTALL_ROOT.dev ? null : INSTALL_ROOT.root;
}

export function versionAtRoot(root: string): string | null {
  try {
    return fs.readFileSync(path.join(root, "VERSION"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function readRootFile(name: string): string | null {
  const root = distRoot();
  if (!root) return null;
  try {
    return fs.readFileSync(path.join(root, name), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function installedVersion(): string | null {
  return readRootFile("VERSION");
}

export function installedChannel(): string {
  return readRootFile("CHANNEL") ?? "stable";
}

export function stagedVersion(): string | null {
  const root = distRoot();
  return root ? versionAtRoot(`${root}.new`) : null;
}

export function brewPrefix(): string | null {
  const root = distRoot();
  if (!root) return null;
  const parts = root.split(path.sep);
  const at = parts.indexOf("Caskroom");
  if (at < 1) return null;
  return parts.slice(0, at).join(path.sep);
}

// brew upgrades replace the versioned Caskroom dir, deleting the one this
// process started from; walk the cask dir to find where the install lives now
export function currentDistRoot(): string | null {
  const configured = distRoot();
  if (!configured) return null;
  if (fs.existsSync(configured)) return configured;
  const parts = configured.split(path.sep);
  const at = parts.indexOf("Caskroom");
  if (at < 0 || parts.length < at + 4) return null;
  const caskDir = parts.slice(0, at + 2).join(path.sep);
  const rest = parts.slice(at + 3);
  try {
    for (const entry of fs.readdirSync(caskDir)) {
      const candidate = [caskDir, entry, ...rest].join(path.sep);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {}
  return null;
}

export function releaseTarget(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux";
  return `${os}-${process.arch}`;
}

export async function fetchLatestManifest(channel: string): Promise<ReleaseManifest> {
  const url =
    channel === "stable" ? `${RELEASE_ORIGIN}/latest.json` : `${RELEASE_ORIGIN}/${channel}/latest.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`release check failed (${response.status} from ${url})`);
  const parsed = releaseManifestSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(`release check failed (bad manifest from ${url})`);
  return parsed.data;
}

function parseStableVersion(value: string): number[] | null {
  const numbers = value.replace(/^v/, "").split(".").map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return numbers;
}

// dev versions (main-<sha>) have no order, so any different version counts
export function isNewerVersion(current: string, latest: string, channel: string): boolean {
  if (latest === current) return false;
  if (channel !== "stable") return true;
  const a = parseStableVersion(current);
  const b = parseStableVersion(latest);
  if (!a || !b) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return right > left;
  }
  return false;
}
