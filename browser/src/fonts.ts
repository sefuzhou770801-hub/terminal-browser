import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The engine draws each string with a single font and has no per-glyph fallback,
// so the UI font itself has to cover Chinese. The bundled JetBrains Mono does not.
export function uiFontCandidates(
  env: NodeJS.ProcessEnv,
  bundled: string,
  exists: (file: string) => boolean = fs.existsSync,
  home: string = os.homedir(),
): string[] {
  const preferred = [
    env.TERMINAL_BROWSER_UI_FONT,
    path.join(home, "Library", "Fonts", "MapleMono-CN-Regular.ttf"),
    "/Library/Fonts/MapleMono-CN-Regular.ttf",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
  ].filter((file): file is string => Boolean(file) && exists(file!));
  return [...new Set([...preferred, bundled])];
}

export async function registerUiFont(
  candidates: string[],
  register: (file: string) => Promise<number>,
): Promise<{ id: number; file: string }> {
  let lastError: unknown = null;
  for (const file of candidates) {
    try {
      return { id: await register(file), file };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("no UI font to register");
}
