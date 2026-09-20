import { z } from "zod";

import { store } from "./client";

// why are we using raw sql here?
function getAppState(key: string): string | null {
  const row = store()
    .sqlite.prepare("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setAppState(key: string, value: string): void {
  store()
    .sqlite.prepare(
      "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function lastUrl(): string | null {
  return getAppState("last-url");
}

export function setLastUrl(url: string): void {
  setAppState("last-url", url);
}

const updateCheckSchema = z.object({ at: z.number(), version: z.string() });

export type UpdateCheck = z.infer<typeof updateCheckSchema>;

export function updateCheck(): UpdateCheck | null {
  const raw = getAppState("update-check");
  if (!raw) return null;
  try {
    const parsed = updateCheckSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setUpdateCheck(check: UpdateCheck): void {
  setAppState("update-check", JSON.stringify(check));
}
