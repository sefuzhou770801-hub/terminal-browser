import { execFile, execFileSync } from "node:child_process";
import { createHash, randomFillSync } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  brewPrefix,
  currentDistRoot,
  distRoot,
  fetchLatestManifest,
  installedChannel,
  installedVersion,
  isNewerVersion,
  releaseTarget,
  setUpdateCheck,
  stagedVersion,
  updateCheck,
  versionAtRoot,
} from "pixel-store";
import type { ReleaseManifest } from "pixel-store";
import type { UpdateView } from "./ui/types";

const execFileAsync = promisify(execFile);

const CHECK_EVERY_MS = 4 * 60 * 60_000;
const PROGRESS_EVERY_MS = 120;

type UpdatePhase =
  | { state: "idle" }
  | { state: "available"; version: string }
  | { state: "downloading"; version: string; percent: number | null }
  | { state: "staged"; version: string }
  | { state: "restarting" };

export interface UpgradeEvent {
  event: "upgrade";
  state: string;
  percent?: number | null;
  version?: string;
}

function logUpdateError(error: unknown) {
  process.stderr.write(`terminal-browser update: ${String(error)}\n`);
}

// electron's asar-aware fs treats bundled .asar files as directories, so
// fs.rm can never finish deleting an install tree; rm(1) has no such trap
function rmTree(target: string) {
  execFileSync("rm", ["-rf", target]);
}

function rmTreeDetached(target: string) {
  execFile("rm", ["-rf", target], () => {});
}

function rmTreeAsync(target: string): Promise<void> {
  return execFileAsync("rm", ["-rf", target]).then(() => {});
}

export class UpdateManager {
  private readonly root = distRoot();
  private phase: UpdatePhase = { state: "idle" };
  private checking = false;
  private readonly listeners = new Set<() => void>();
  private restartExecutor: (() => Promise<void>) | null = null;
  private downloadRunning: Promise<void> | null = null;
  private mock: ReleaseManifest | null = null;
  private mockServer: http.Server | null = null;
  private mockStaging = false;
  private mockRoot: string | null = null;
  private mockBrewStyle = false;
  private brewTried: string | null = null;

  // whether this install has a release channel worth asking about
  canCheck(): boolean {
    return this.root != null && installedVersion() != null && installedChannel() !== "local";
  }

  // the env var only silences background polling; an explicit check still works
  start() {
    if (!this.canCheck()) return;
    if (process.env.TERMINAL_BROWSER_NO_UPDATE_CHECK === "1") return;
    void this.check(false).catch(logUpdateError);
    setInterval(() => void this.check(false).catch(logUpdateError), CHECK_EVERY_MS).unref();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setRestartExecutor(executor: () => Promise<void>) {
    this.restartExecutor = executor;
  }

  view(): UpdateView | null {
    const phase = this.phase;
    switch (phase.state) {
      case "idle":
        return this.checking ? { state: "checking", version: null, percent: null } : null;
      case "available":
        return { state: "available", version: phase.version, percent: null };
      case "downloading":
        return { state: "downloading", version: phase.version, percent: phase.percent };
      case "staged":
        return { state: "staged", version: phase.version, percent: null };
      case "restarting":
        return { state: "restarting", version: null, percent: null };
    }
  }

  private notify() {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {}
    }
  }

  private setPhase(phase: UpdatePhase) {
    this.phase = phase;
    this.notify();
  }

  // reads through a call so stale control-flow narrowing of this.phase does not apply
  private phaseState(): UpdatePhase["state"] {
    return this.phase.state;
  }

  // the mock has an install root even in a dev checkout, where the real one is null
  private updateRoot(): string | null {
    return this.mock && this.mockRoot ? this.mockRoot : this.root;
  }

  // brew owns the files of a Caskroom install: it downloads and replaces the
  // versioned dir, and we only contribute the restart-with-restore on top
  private brewManaged(): boolean {
    return !this.mock && brewPrefix() != null;
  }

  private brewStagedVersion(): string | null {
    const root = currentDistRoot();
    if (!root || !this.root || root === this.root) return null;
    return versionAtRoot(root);
  }

  canMock(): boolean {
    return this.phase.state === "idle" && !this.mock && !this.mockStaging;
  }

  // fakes a release of the current build so the whole real pipeline can be
  // exercised repeatedly: download, stage, swap, restart, restore. A dev
  // checkout has no install root, so it gets a scratch one and swaps that.
  // brewStyle only changes the presentation: no byte progress, like a brew run.
  async mockUpdate(brewStyle = false): Promise<void> {
    if (!this.canMock()) return;
    this.mockBrewStyle = brewStyle;
    this.mockStaging = true;
    try {
      let root = this.root;
      let version = installedVersion();
      if (!root || !version) {
        version = "mock-dev";
        root = createMockScratch(version);
        this.mockRoot = root;
      }
      const tarball = `${root}.mock.tar.gz`;
      fs.rmSync(tarball, { force: true });
      await execFileAsync("tar", ["-czf", tarball, "-C", path.dirname(root), path.basename(root)]);
      const sha256 = await hashFile(tarball);
      const size = fs.statSync(tarball).size;
      const { server, url } = await serveMockTarball(tarball);
      this.mockServer = server;
      this.mock = {
        version,
        channel: installedChannel(),
        install: url,
        platforms: { [releaseTarget()]: { file: path.basename(tarball), sha256, size, url } },
      };
      this.setPhase({ state: "available", version });
    } catch (error) {
      logUpdateError(error);
    } finally {
      this.mockStaging = false;
    }
  }

  private clearMock() {
    if (!this.mock) return;
    this.mock = null;
    this.mockBrewStyle = false;
    this.mockServer?.close();
    this.mockServer = null;
    if (this.root) fs.rmSync(`${this.root}.mock.tar.gz`, { force: true });
    if (this.mockRoot) {
      rmTreeDetached(path.dirname(this.mockRoot));
      this.mockRoot = null;
    }
  }

  async check(force: boolean): Promise<void> {
    if (!this.root || this.mock || this.phase.state === "restarting") return;
    if (installedChannel() === "local") return;
    const current = installedVersion();
    if (!current) return;
    const cached = force ? null : updateCheck();
    if (cached && Date.now() - cached.at < CHECK_EVERY_MS) {
      if (this.phase.state !== "downloading") this.evaluate(current, cached.version);
      return;
    }
    this.checking = true;
    this.notify();
    try {
      const manifest = await fetchLatestManifest(installedChannel());
      try {
        setUpdateCheck({ at: Date.now(), version: manifest.version });
      } catch {}
      if (this.phase.state === "downloading") return;
      this.evaluate(current, manifest.version);
    } finally {
      this.checking = false;
      this.notify();
    }
  }

  private evaluate(current: string, latest: string) {
    if (!isNewerVersion(current, latest, installedChannel())) {
      this.clearMock();
      this.discardStaged();
      this.setPhase({ state: "idle" });
      return;
    }
    if (this.brewManaged()) {
      const staged = this.brewStagedVersion();
      if (staged && staged !== current) this.setPhase({ state: "staged", version: staged });
      else if (this.brewTried === latest) this.setPhase({ state: "idle" });
      else this.setPhase({ state: "available", version: latest });
      return;
    }
    if (stagedVersion() === latest) this.setPhase({ state: "staged", version: latest });
    else this.setPhase({ state: "available", version: latest });
  }

  // fire and forget: a later stage re-clears the path before renaming into it
  private discardStaged() {
    if (!this.root) return;
    rmTreeDetached(`${this.root}.new`);
  }

  download(): Promise<void> {
    if (this.downloadRunning) return this.downloadRunning;
    if (this.phase.state !== "available") return Promise.resolve();
    const run = this.brewManaged() ? this.runBrewUpgrade() : this.runDownload();
    this.downloadRunning = run.finally(() => {
      this.downloadRunning = null;
    });
    return this.downloadRunning;
  }

  // shell out to brew: it downloads, verifies, and replaces the Caskroom dir.
  // No byte progress from brew, so the phase reports percent null throughout.
  private async runBrewUpgrade(): Promise<void> {
    if (this.phase.state !== "available") return;
    const wanted = this.phase.version;
    const prefix = brewPrefix();
    const current = installedVersion();
    if (!prefix || !current) return;
    this.setPhase({ state: "downloading", version: wanted, percent: null });
    try {
      await execFileAsync(path.join(prefix, "bin", "brew"), ["upgrade", "--cask", "terminal-browser"], {
        timeout: 10 * 60_000,
        env: { ...process.env, HOMEBREW_NO_ENV_HINTS: "1" },
      });
    } catch (error) {
      logUpdateError(error);
    }
    this.brewTried = wanted;
    const staged = this.brewStagedVersion();
    if (staged && staged !== current) this.setPhase({ state: "staged", version: staged });
    else this.setPhase({ state: "idle" });
  }

  private async runDownload(): Promise<void> {
    const root = this.updateRoot();
    if (!root || this.phase.state !== "available") return;
    const wanted = this.phase.version;
    try {
      const manifest = this.mock ?? (await fetchLatestManifest(installedChannel()));
      if (!this.mock) {
        try {
          setUpdateCheck({ at: Date.now(), version: manifest.version });
        } catch {}
      }
      const current = this.mock ? wanted : installedVersion();
      if (!current) return;
      if (manifest.version !== wanted) {
        this.evaluate(current, manifest.version);
        if (this.phase.state !== "available") return;
      }
      const version = manifest.version;
      const platform = manifest.platforms?.[releaseTarget()];
      if (!platform) throw new Error(`[placeholder copy: no build for ${releaseTarget()}]`);
      this.setPhase({ state: "downloading", version, percent: this.mockBrewStyle ? null : 0 });
      const tarball = `${root}.download`;
      await this.fetchTarball(platform.url, platform.sha256, platform.size, tarball, version);
      const stage = `${root}.stage`;
      await rmTreeAsync(stage);
      fs.mkdirSync(stage, { recursive: true });
      await execFileAsync("tar", ["-xzf", tarball, "-C", stage, "--strip-components", "1"]);
      fs.rmSync(tarball, { force: true });
      const staged = versionAtRoot(stage);
      if (staged !== version) {
        rmTreeDetached(stage);
        throw new Error(`[placeholder copy: staged ${staged}, expected ${version}]`);
      }
      await rmTreeAsync(`${root}.new`);
      fs.renameSync(stage, `${root}.new`);
      this.setPhase({ state: "staged", version });
    } catch (error) {
      logUpdateError(error);
      if (this.phaseState() === "downloading") this.setPhase({ state: "available", version: wanted });
    }
  }

  private async fetchTarball(url: string, sha256: string, size: number, file: string, version: string) {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`[placeholder copy: download failed (${response.status} from ${url})]`);
    }
    const hash = createHash("sha256");
    const out = fs.createWriteStream(file);
    let received = 0;
    let lastEmit = 0;
    try {
      for await (const part of response.body) {
        const chunk = Buffer.from(part as Uint8Array);
        hash.update(chunk);
        received += chunk.length;
        if (!out.write(chunk)) await once(out, "drain");
        const now = Date.now();
        if (now - lastEmit >= PROGRESS_EVERY_MS && this.phase.state === "downloading") {
          lastEmit = now;
          const percent =
            this.mockBrewStyle || size <= 0 ? null : Math.min(100, Math.round((received / size) * 100));
          this.setPhase({ state: "downloading", version, percent });
        }
      }
      out.end();
      await once(out, "finish");
    } catch (error) {
      out.destroy();
      fs.rmSync(file, { force: true });
      throw error;
    }
    if (hash.digest("hex") !== sha256) {
      fs.rmSync(file, { force: true });
      throw new Error("[placeholder copy: sha256 mismatch]");
    }
  }

  requestRestart(): void {
    void this.performRestart().catch(logUpdateError);
  }

  private async performRestart(): Promise<void> {
    const root = this.updateRoot();
    if (!root || this.phase.state !== "staged") return;
    if (this.brewManaged()) {
      const staged = this.brewStagedVersion();
      if (!staged) {
        this.setPhase({ state: "idle" });
        return;
      }
      this.setPhase({ state: "restarting" });
      try {
        await this.restartExecutor?.();
      } catch (error) {
        logUpdateError(error);
        this.setPhase({ state: "staged", version: staged });
      }
      return;
    }
    let manifest: ReleaseManifest;
    let current: string;
    if (this.mock) {
      manifest = this.mock;
      current = manifest.version;
    } else {
      const installed = installedVersion();
      if (!installed) return;
      current = installed;
      try {
        manifest = await fetchLatestManifest(installedChannel());
      } catch (error) {
        logUpdateError(error);
        return;
      }
      try {
        setUpdateCheck({ at: Date.now(), version: manifest.version });
      } catch {}
    }
    if (versionAtRoot(`${root}.new`) !== manifest.version) {
      if (this.mock) {
        this.clearMock();
        this.setPhase({ state: "idle" });
      } else {
        this.evaluate(current, manifest.version);
      }
      return;
    }
    this.setPhase({ state: "restarting" });
    try {
      await this.restartExecutor?.();
    } catch (error) {
      logUpdateError(error);
      if (!this.mock) this.evaluate(current, manifest.version);
    }
  }

  // running processes keep working off the renamed tree; only new spawns see the swap
  swap(): void {
    if (this.brewManaged()) {
      // brew already replaced the versioned Caskroom dir; nothing of ours to move
      if (!this.brewStagedVersion()) throw new Error("[placeholder copy: no new brew version]");
      return;
    }
    const root = this.updateRoot();
    if (!root) throw new Error("[placeholder copy: no install root]");
    const staged = `${root}.new`;
    const old = `${root}.old`;
    if (!versionAtRoot(staged)) throw new Error("[placeholder copy: nothing staged]");
    rmTree(old);
    fs.renameSync(root, old);
    try {
      fs.renameSync(staged, root);
    } catch (error) {
      fs.renameSync(old, root);
      throw error;
    }
  }

  // skills relinking is not repeated here: the CLI's ensureSetup marker keys on
  // version + root and relinks on the next invocation after a swap
  bootCleanup(): void {
    const root = this.root;
    if (!root) return;
    rmTreeDetached(`${root}.old`);
    fs.rm(`${root}.mock.tar.gz`, { force: true }, () => {});
  }

  async upgradeFromCli(emit: (event: UpgradeEvent) => void): Promise<void> {
    if (!this.root || !installedVersion()) {
      emit({ event: "upgrade", state: "failed" });
      return;
    }
    try {
      await this.check(true);
    } catch (error) {
      logUpdateError(error);
      emit({ event: "upgrade", state: "failed" });
      return;
    }
    if (this.phase.state === "idle") {
      emit({ event: "upgrade", state: "current", version: installedVersion() ?? undefined });
      return;
    }
    const unsubscribe = this.subscribe(() => {
      const view = this.view();
      if (!view) return;
      emit({ event: "upgrade", state: view.state, percent: view.percent ?? undefined });
    });
    try {
      if (this.phase.state === "available") await this.download();
      if (this.phase.state === "staged") await this.performRestart();
      if (this.phaseState() !== "restarting") emit({ event: "upgrade", state: "failed" });
    } finally {
      unsubscribe();
    }
  }
}

// a plausible install tree for dev checkouts: enough incompressible bytes
// that the download progress ring is actually visible through the throttle
function createMockScratch(version: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terminal-browser-mock-"));
  const root = path.join(dir, "app");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "VERSION"), `${version}\n`);
  fs.writeFileSync(path.join(root, "CHANNEL"), "mock\n");
  const filler = Buffer.allocUnsafe(32 * 1024 * 1024);
  randomFillSync(filler);
  fs.writeFileSync(path.join(root, "payload.bin"), filler);
  return root;
}

function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    fs.createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

// drips the file out in chunks so the progress ring is visible on loopback
function serveMockTarball(file: string): Promise<{ server: http.Server; url: string }> {
  const CHUNK = 2 * 1024 * 1024;
  const TICK_MS = 60;
  const server = http.createServer((_request, response) => {
    let size: number;
    let fd: number;
    try {
      size = fs.statSync(file).size;
      fd = fs.openSync(file, "r");
    } catch {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("content-length", String(size));
    let offset = 0;
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      fs.closeSync(fd);
    };
    response.on("close", finish);
    const tick = () => {
      if (closed) return;
      const buffer = Buffer.alloc(Math.min(CHUNK, size - offset));
      if (buffer.length === 0) {
        response.end();
        finish();
        return;
      }
      try {
        fs.readSync(fd, buffer, 0, buffer.length, offset);
      } catch {
        response.destroy();
        finish();
        return;
      }
      offset += buffer.length;
      response.write(buffer, () => setTimeout(tick, TICK_MS));
    };
    tick();
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("[placeholder copy: mock server has no port]"));
        return;
      }
      server.unref();
      resolve({ server, url: `http://127.0.0.1:${address.port}/${path.basename(file)}` });
    });
  });
}

let manager: UpdateManager | null = null;

export function updates(): UpdateManager {
  manager ??= new UpdateManager();
  return manager;
}
