import os from "node:os";
import path from "node:path";

import type { EngineKeyEvent } from "@zenbu-labs/pixel";

import { bundledAsset } from "../assets";
import { commandLabel, isCommandId } from "../config/commands";
import type { CommandId } from "../config/commands";
import { ConfigStore } from "../config/config";
import type { ConfigFiles } from "../config/config";
import { Keymap, chordFromEvent, formatChord } from "../config/keys";
import type { Chord, KeybindingOverrides } from "../config/keys";
import { SUGGESTIONS_OFF, engineBySearch, engineBySuggest } from "../config/search";
import { SETTINGS, SETTING_KEYS, defaultSettings, isSettingKey } from "../config/settings";
import type { SettingKey, Settings } from "../config/settings";
import type { SettingRow, SettingsActions, SettingsSection, SettingsView } from "../ui/types";

export interface SettingsHost {
  requestRender(): void;
  toast(text: string, state: "done" | "failed"): void;
  setClipboard(text: string): void;
  openUrl(url: string): void;
  overlayOpened(): void;
  overlayClosed(): void;
}

interface Modal {
  section: SettingsSection;
  query: string;
  recording: { id: CommandId; chord: Chord | null } | null;
  drafts: Partial<Record<SettingKey, string>>;
}

function settingRow(key: SettingKey, value: string): SettingRow {
  const def = SETTINGS[key];
  const base = { key, label: def.label, hint: def.hint, link: def.link, modified: value !== def.default };
  if (!def.choices) return { ...base, kind: "string", value };
  const choices = def.choices.map((choice) => ({
    ...choice,
    logo: choice.logo ? bundledAsset(choice.logo) : null,
  }));
  return { ...base, kind: "choice", value, choices };
}

function agentBrief(files: ConfigFiles): string {
  return [
    "terminal-browser config files:",
    `  settings: ${files.settings}`,
    `  keybindings: ${files.keybindings}`,
    "More documentation about features, settings, and keybinds are available at the project's readme",
    "https://github.com/zenbu-labs/terminal-browser/README.md",
    "",
  ].join("\n");
}

function homeRelative(file: string): string {
  const home = os.homedir();
  return file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file;
}

export class SettingsManager {
  private readonly config: ConfigStore;
  private values: Settings;
  private overrides: KeybindingOverrides;
  private map: Keymap;
  private noSuper = false;
  private stopWatching: (() => void) | null = null;
  private modal: Modal | null = null;
  private lastSection: SettingsSection = "general";

  constructor(
    private readonly host: SettingsHost,
    files: ConfigFiles,
  ) {
    this.config = new ConfigStore(files);
    const loaded = this.config.load();
    this.values = loaded.settings ?? defaultSettings();
    this.overrides = loaded.keybindings ?? {};
    this.map = new Keymap(this.overrides, { noSuper: false });
  }

  get<K extends SettingKey>(key: K): Settings[K] {
    return this.values[key];
  }

  get keymap(): Keymap {
    return this.map;
  }

  get isOpen(): boolean {
    return this.modal !== null;
  }

  get recording(): boolean {
    return this.modal?.recording !== null && this.modal?.recording !== undefined;
  }

  setNoSuper(noSuper: boolean) {
    this.noSuper = noSuper;
    this.reload(false);
  }

  reload(announce: boolean) {
    const loaded = this.config.load();
    if (loaded.settings) this.values = loaded.settings;
    if (loaded.keybindings) this.overrides = loaded.keybindings;
    this.map = new Keymap(this.overrides, { noSuper: this.noSuper });
    this.host.requestRender();
    if (loaded.errors.length) this.host.toast(loaded.errors[0], "failed");
    else if (announce) this.host.toast("config reloaded", "done");
  }

  watch() {
    this.stopWatching?.();
    this.stopWatching = this.config.watch(() => this.reload(true));
  }

  dispose() {
    this.stopWatching?.();
    this.stopWatching = null;
  }

  open() {
    if (this.modal) return;
    this.modal = { section: this.lastSection, query: "", recording: null, drafts: {} };
    this.host.overlayOpened();
    this.host.requestRender();
  }

  close() {
    const modal = this.modal;
    if (!modal) return;
    this.modal = null;
    this.commitDrafts(modal);
    this.host.overlayClosed();
    this.host.requestRender();
  }

  recordKey(event: EngineKeyEvent) {
    const recording = this.modal?.recording;
    if (!recording) return;
    const chord = chordFromEvent(event);
    if (!chord) return;
    const pressed = formatChord(chord);
    if (pressed === "escape") {
      this.modal!.recording = null;
      this.host.requestRender();
      return;
    }
    if (pressed === "enter" && recording.chord) {
      const keys = [formatChord(recording.chord)];
      this.modal!.recording = null;
      this.write(() => this.config.setKeybinding(recording.id, keys));
      return;
    }
    recording.chord = chord;
    this.host.requestRender();
  }

  readonly actions: SettingsActions = {
    close: () => this.close(),
    section: (section) => {
      const modal = this.modal;
      if (!modal) return;
      this.commitDrafts(modal);
      modal.section = section;
      modal.recording = null;
      this.lastSection = section;
      this.host.requestRender();
    },
    query: (text) => {
      if (!this.modal) return;
      this.modal.query = text;
      this.host.requestRender();
    },
    recordShortcut: (id) => {
      if (!this.modal || !isCommandId(id)) return;
      this.modal.recording = { id, chord: null };
      this.host.requestRender();
    },
    cancelRecording: () => {
      if (!this.modal) return;
      this.modal.recording = null;
      this.host.requestRender();
    },
    resetShortcut: (id) => {
      if (isCommandId(id)) this.write(() => this.config.setKeybinding(id, undefined));
    },
    unbindShortcut: (id) => {
      if (isCommandId(id)) this.write(() => this.config.setKeybinding(id, null));
    },
    set: (key, value) => this.set(key, value),
    reset: (key) => this.set(key, undefined),
    draft: (key, text) => {
      if (this.modal && isSettingKey(key)) this.modal.drafts[key] = text;
    },
    reloadConfig: () => this.reload(true),
    copyAgentBrief: () => {
      this.host.setClipboard(agentBrief(this.config.files));
      this.host.toast("copied to clipboard", "done");
    },
    copyPath: (file) => {
      this.host.setClipboard(this.config.files[file]);
      this.host.toast("copied to clipboard", "done");
    },
    openLink: (url) => {
      this.close();
      this.host.openUrl(url);
    },
  };

  view(): SettingsView | null {
    const modal = this.modal;
    if (!modal) return null;
    const query = modal.query.trim().toLowerCase();
    const keyQuery = query.replace(/\s+/g, "+");
    const shortcuts = this.map
      .all()
      .map((binding) => ({
        id: binding.id,
        label: commandLabel(binding.id),
        keys: this.map.labels(binding.id),
        modified: binding.modified,
        conflicts: this.map.conflicts(binding.id).map(commandLabel),
      }))
      .filter(
        (row) =>
          !query ||
          row.label.toLowerCase().includes(query) ||
          row.id.includes(query) ||
          row.keys.some((key) => key.includes(keyQuery)),
      );
    return {
      section: modal.section,
      query: modal.query,
      recording: modal.recording && {
        id: modal.recording.id,
        label: commandLabel(modal.recording.id),
        keys: modal.recording.chord ? formatChord(modal.recording.chord) : "",
      },
      shortcuts,
      settings: SETTING_KEYS.map((key) => settingRow(key, this.values[key])),
      files: {
        settings: homeRelative(this.config.files.settings),
        keybindings: homeRelative(this.config.files.keybindings),
      },
    };
  }

  private set(key: string, value: string | undefined) {
    if (!isSettingKey(key)) return;
    if (value !== undefined && !SETTINGS[key].schema.safeParse(value).success) return;
    delete this.modal?.drafts[key];
    this.write(() => {
      this.config.setSetting(key, value as Settings[SettingKey] | undefined);
      if (key === "search.engine") this.followEngine(value as string | undefined);
    });
  }

  private followEngine(nextSearch: string | undefined) {
    const suggestions = this.values["search.suggestions"];
    if (suggestions === SUGGESTIONS_OFF) return;
    const previous = engineBySearch(this.values["search.engine"]);
    if (!previous || engineBySuggest(suggestions)?.id !== previous.id) return;
    const next = engineBySearch(nextSearch ?? SETTINGS["search.engine"].default);
    if (!next?.suggest || next.suggest === suggestions) return;
    const isDefault = next.suggest === SETTINGS["search.suggestions"].default;
    this.config.setSetting("search.suggestions", isDefault ? undefined : next.suggest);
  }

  private commitDrafts(modal: Modal) {
    for (const key of SETTING_KEYS) {
      const draft = modal.drafts[key];
      delete modal.drafts[key];
      if (draft !== undefined && draft !== this.values[key]) this.set(key, draft);
    }
  }

  private write(write: () => void) {
    try {
      write();
    } catch (error) {
      this.host.toast(error instanceof Error ? error.message : String(error), "failed");
      return;
    }
    this.reload(false);
  }
}
