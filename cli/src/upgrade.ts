import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

import {
  brewPrefix,
  fetchLatestManifest,
  installedChannel,
  installedVersion,
  isNewerVersion,
} from "pixel-store";

import { connectDaemon, nextReply } from "./daemon-client";
import { instances } from "./registry";
import type { InstanceRecord } from "./registry";

function describeInstance(record: InstanceRecord): string {
  const page = record.title && record.title !== record.url ? `${record.title}  ${record.url}` : record.url;
  return `  ${record.key}  ${page}`;
}

async function confirmClose(version: string, open: InstanceRecord[]): Promise<boolean> {
  process.stdout.write(`upgrading to ${version} closes these open browsers:\n`);
  process.stdout.write(`${open.map(describeInstance).join("\n")}\n`);
  const ask = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    ask.question("continue? [Y/n] ", resolve);
    ask.on("close", () => resolve("n"));
  });
  ask.close();
  return /^(y|yes|)$/i.test(answer.trim());
}

function runInstaller(url: string): Promise<number> {
  const child = spawn("bash", ["-c", `curl -fsSL '${url}' | bash`], { stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

// a live daemon upgrades itself in place and restarts, so open browsers survive
async function upgradeViaDaemon(): Promise<number | null> {
  let socket;
  try {
    socket = await connectDaemon();
  } catch {
    return null;
  }
  return new Promise<number>((resolve) => {
    let restarting = false;
    let settled = false;
    let progressShown = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      if (progressShown) process.stdout.write("\n");
      socket.destroy();
      resolve(code);
    };
    const timer = setTimeout(() => finish(restarting ? 0 : 1), 10 * 60_000);
    nextReply(socket, (reply) => {
      if (reply.event !== "upgrade") return;
      if (reply.state === "current") {
        process.stdout.write(`already up to date (${reply.version ?? ""})\n`);
        clearTimeout(timer);
        finish(0);
      } else if (reply.state === "downloading") {
        if (typeof reply.percent === "number") {
          progressShown = true;
          process.stdout.write(`\r${reply.percent}%`);
        }
      } else if (reply.state === "restarting") {
        restarting = true;
      } else if (reply.state === "failed") {
        clearTimeout(timer);
        process.stderr.write("[placeholder copy: upgrade failed, see the daemon log]\n");
        finish(1);
      }
    });
    socket.on("close", () => {
      clearTimeout(timer);
      finish(restarting ? 0 : 1);
    });
    socket.on("error", () => finish(restarting ? 0 : 1));
    socket.write('{"cmd":"upgrade"}\n');
  });
}

export async function upgradeCommand(): Promise<number> {
  const current = installedVersion();
  if (!current) {
    throw new Error("Could not perform upgrade: please file an issue https://github.com/zenbu-labs/terminal-browser/issues");
  }
  const channel = installedChannel();
  if (channel === "local") {
    process.stdout.write("[placeholder copy: this is a local build, reinstall it with pnpm dist]\n");
    return 0;
  }
  const latest = await fetchLatestManifest(channel);
  if (!isNewerVersion(current, latest.version, channel)) {
    process.stdout.write(`already up to date (${current})\n`);
    return 0;
  }
  const delegated = await upgradeViaDaemon();
  if (delegated !== null) return delegated;
  const prefix = brewPrefix();
  if (prefix) {
    const brew = spawn(path.join(prefix, "bin", "brew"), ["upgrade", "--cask", "terminal-browser"], {
      stdio: "inherit",
    });
    return new Promise((resolve, reject) => {
      brew.on("error", reject);
      brew.on("exit", (code) => resolve(code ?? 1));
    });
  }
  const open = await instances();
  if (open.length > 0 && process.stdin.isTTY && process.stdout.isTTY) {
    if (!(await confirmClose(latest.version, open))) {
      process.stdout.write("cancelled\n");
      return 0;
    }
  }
  return runInstaller(latest.install);
}
