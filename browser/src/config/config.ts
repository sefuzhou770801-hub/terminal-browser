import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { COMMAND_IDS, isCommandId } from "./commands";
import type { CommandId } from "./commands";
import { jsonText } from "./json";
import { parseChord } from "./keys";
import type { ShortcutOverrides } from "./keys";
import { SETTINGS, SETTING_KEYS, defaultSettings } from "./settings";
import type { SettingKey, Settings } from "./settings";

export interface ConfigFiles {
  settings: string;
  shortcuts: string;
}


export interface LoadedConfig {
  settings: Settings | null;
  shortcuts: ShortcutOverrides | null;
  errors: string[];
}

export type ConfigFile = keyof ConfigFiles;

const WATCH_SETTLE_MS = 150;

const jsonObject = z
  .string()
  .transform((text) => (text.trim() ? text : "{}"))
  .pipe(jsonText)
  .pipe(z.record(z.string(), z.unknown()));

type JsonObject = z.infer<typeof jsonObject>;

const chord = z.string().refine((spec) => parseChord(spec) !== null, {
  message: "not a valid key chord",
});

const shortcut = z.union([z.null(), chord.transform((key) => [key]), z.array(chord)]);

function deepestIssue(issues: z.core.$ZodIssue[]): { path: PropertyKey[]; message: string } {
  let best = issues[0];
  const visit = (issue: z.core.$ZodIssue) => {
    if (issue.path.length > best.path.length) best = issue;
    if (issue.code === "invalid_union") for (const branch of issue.errors) branch.forEach(visit);
  };
  issues.forEach(visit);
  return best;
}

function describe(file: string, issue: { path: PropertyKey[]; message: string }): string {
  const where = [path.basename(file), ...issue.path.map(String)].join(" › ");
  return ` ${where}: ${issue.message}`;
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJsonObject(file: string): { value: JsonObject | null; error: string | null } {
  const parsed = jsonObject.safeParse(readText(file));
  if (parsed.success) return { value: parsed.data, error: null };
  return { value: null, error: describe(file, parsed.error.issues[0]) };
}

function settingsFrom(file: string, raw: JsonObject): { value: Settings; errors: string[] } {
  const value = defaultSettings() as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of SETTING_KEYS) {
    if (raw[key] === undefined) continue;
    const parsed = SETTINGS[key].schema.safeParse(raw[key]);
    if (parsed.success) value[key] = parsed.data;
    else errors.push(describe(file, { path: [key], message: parsed.error.issues[0].message }));
  }
  return { value: value as Settings, errors };
}

function shortcutsFrom(file: string, raw: JsonObject): { value: ShortcutOverrides; errors: string[] } {
  const value: ShortcutOverrides = {};
  const errors: string[] = [];
  for (const [id, entry] of Object.entries(raw)) {
    if (!isCommandId(id)) {
      errors.push(describe(file, { path: [id], message: `unknown command, expected one of ${COMMAND_IDS.join(", ")}` }));
      continue;
    }
    const parsed = shortcut.safeParse(entry);
    if (parsed.success) value[id] = parsed.data;
    else {
      const issue = deepestIssue(parsed.error.issues);
      errors.push(describe(file, { path: [id, ...issue.path], message: issue.message }));
    }
  }
  return { value, errors };
}

function digest(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export class ConfigStore {
  private readonly written = new Map<string, string>();

  constructor(readonly files: ConfigFiles) {}

  load(): LoadedConfig {
    const settingsFile = readJsonObject(this.files.settings);
    const shortcutsFile = readJsonObject(this.files.shortcuts);
    const settings = settingsFile.value && settingsFrom(this.files.settings, settingsFile.value);
    const shortcuts =
      shortcutsFile.value && shortcutsFrom(this.files.shortcuts, shortcutsFile.value);
    return {
      settings: settings?.value ?? null,
      shortcuts: shortcuts?.value ?? null,
      errors: [
        settingsFile.error,
        ...(settings?.errors ?? []),
        shortcutsFile.error,
        ...(shortcuts?.errors ?? []),
      ].filter((error): error is string => !!error),
    };
  }

  ownContent(file: ConfigFile): boolean {
    const written = this.written.get(this.files[file]);
    return written !== undefined && written === digest(readText(this.files[file]));
  }

  watch(onChange: (files: ConfigFile[]) => void): () => void {
    const names: ConfigFile[] = ["settings", "shortcuts"];
    const seen = new Map<ConfigFile, string>(
      names.map((name) => [name, digest(readText(this.files[name]))]),
    );
    const pending = new Set<ConfigFile>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = () => {
      timer = null;
      const changed = [...pending].filter((name) => {
        const now = digest(readText(this.files[name]));
        if (now === seen.get(name)) return false;
        seen.set(name, now);
        return !this.ownContent(name);
      });
      pending.clear();
      if (changed.length) onChange(changed);
    };
    const watchers = [...new Set(names.map((name) => path.dirname(this.files[name])))].map((dir) => {
      fs.mkdirSync(dir, { recursive: true });
      return fs.watch(dir, (_event, filename) => {
        for (const name of names) {
          if (path.dirname(this.files[name]) !== dir) continue;
          if (filename && filename !== path.basename(this.files[name])) continue;
          pending.add(name);
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(settle, WATCH_SETTLE_MS);
      });
    });
    return () => {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
    };
  }

  setSetting<K extends SettingKey>(key: K, value: Settings[K] | undefined) {
    this.update(this.files.settings, key, value);
  }

  setShortcut(id: CommandId, keys: string[] | null | undefined) {
    this.update(this.files.shortcuts, id, keys === undefined ? undefined : keys?.length === 1 ? keys[0] : keys);
  }

  private update(file: string, key: string, value: unknown) {
    const current = readJsonObject(file);
    if (!current.value) throw new Error(current.error ?? file);
    const next = { ...current.value };
    if (value === undefined) delete next[key];
    else next[key] = value;
    const text = `${JSON.stringify(next, null, 2)}\n`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    this.written.set(file, digest(text));
  }
}
