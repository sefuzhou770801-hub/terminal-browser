import type { SettingsSection } from "../types";

export const copy = {
  sections: {
    general: "general",
    shortcuts: "shortcuts",
    advanced: "advanced",
  } satisfies Record<SettingsSection, string>,
  noMatches: "no matching shortcuts",
  recordPrompt: "Press desired key combination and then press ENTER.",
  unbound: "—",
  conflict: (labels: string[]) => `also ${labels.join(", ")}`,
  reload: "reload config",
  advanced: "advanced",
  agent: ["configure with", "agent"],
  files: { settings: "settings", keybindings: "keybindings" },
  title: (version: string) => `settings - terminal-browser ${version}`,
  updates: {
    version: (version: string) => `version ${version}`,
    check: "check for updates",
    checking: "checking…",
    downloading: "downloading…",
    download: (version: string) => `download ${version}`,
    restart: "restart to update",
    restarting: "restarting…",
    mock: "mock update",
  },
  about: {
    version: "version",
    channel: "channel",
    chromium: "chromium",
    node: "node",
  },
  help: {
    label: "help",
    hint: "questions, bugs, and ideas are welcome on discord",
    discord: "Discord",
  },
};
