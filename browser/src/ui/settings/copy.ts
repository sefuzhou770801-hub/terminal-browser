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
  files: { settings: "settings", shortcuts: "shortcuts" },
};
