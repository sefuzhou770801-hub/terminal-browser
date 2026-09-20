import { z } from "zod";

import { store } from "./client";

const restoreTabSchema = z.object({
  url: z.string().min(1),
  active: z.boolean(),
});

const restoreSnapshotSchema = z.object({
  at: z.number(),
  tabs: z.array(restoreTabSchema).min(1),
});

export type RestoreTab = z.infer<typeof restoreTabSchema>;
export type RestoreSnapshot = z.infer<typeof restoreSnapshotSchema>;

const PREFIX = "restore:";
const MAX_AGE_MS = 5 * 60_000;

// Keyed by tty so each terminal pane gets its own tabs back after the daemon restarts.
export function saveRestoreSnapshot(tty: string, snapshot: RestoreSnapshot): void {
  store()
    .sqlite.prepare("DELETE FROM app_state WHERE key LIKE 'restore:%' AND json_extract(value, '$.at') < ?")
    .run(Date.now() - MAX_AGE_MS);
  store()
    .sqlite.prepare(
      "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(PREFIX + tty, JSON.stringify(snapshot));
}

export function takeRestoreSnapshot(tty: string): RestoreSnapshot | null {
  const key = PREFIX + tty;
  const row = store()
    .sqlite.prepare("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  store().sqlite.prepare("DELETE FROM app_state WHERE key = ?").run(key);
  if (!row) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(row.value);
  } catch {
    return null;
  }
  const parsed = restoreSnapshotSchema.safeParse(raw);
  if (!parsed.success || Date.now() - parsed.data.at > MAX_AGE_MS) return null;
  return parsed.data;
}
