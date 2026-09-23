import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { STRINGS } from "../ui/strings";

export type Run = (command: string, args: string[]) => Promise<string>;

export interface ClosablePane {
  bin: string;
  id: string;
}

const execFileAsync = promisify(execFile);

export const runCommand: Run = async (command, args) => (await execFileAsync(command, args)).stdout;

// A session running inline shares its pane with whatever started it, so only a pane split off for the browser may be closed.
export function closablePane(
  terminal: string | null,
  env: NodeJS.ProcessEnv,
  splitForBrowser: boolean,
): ClosablePane | null {
  if (terminal !== "herdr" || !splitForBrowser) return null;
  const id = env.HERDR_PANE_ID;
  if (!id) return null;
  return { bin: env.HERDR_BIN_PATH || "herdr", id };
}

export async function closeOwnPane(pane: ClosablePane, tty: string | null, run: Run = runCommand): Promise<void> {
  if (!tty) throw new Error(STRINGS.pane.unknownPane);
  const info = JSON.parse(await run(pane.bin, ["pane", "process-info", "--pane", pane.id]));
  const shellPid = info?.result?.process_info?.shell_pid;
  if (shellPid == null) throw new Error(STRINGS.pane.noShell(pane.id));
  const shellTty = (await run("ps", ["-o", "tty=", "-p", String(shellPid)])).trim();
  if (`/dev/${shellTty}` !== tty) throw new Error(STRINGS.pane.notOwnPane(pane.id));
  await run(pane.bin, ["pane", "close", pane.id]);
}
