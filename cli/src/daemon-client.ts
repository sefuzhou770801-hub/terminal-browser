import net from "node:net";

import { z } from "zod";

import { DAEMON_SOCKET } from "pixel-store";

const daemonReplySchema = z.looseObject({
  ok: z.boolean().optional(),
  error: z.string().optional(),
  session: z.string().optional(),
  event: z.string().optional(),
  code: z.number().optional(),
  sessions: z.number().optional(),
  state: z.string().optional(),
  percent: z.number().optional(),
  version: z.string().optional(),
});

export type DaemonReply = z.infer<typeof daemonReplySchema>;

export function connectDaemon(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(DAEMON_SOCKET);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

export function nextReply(socket: net.Socket, onLine: (reply: DaemonReply) => void): void {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = daemonReplySchema.safeParse(raw);
      if (parsed.success) onLine(parsed.data);
    }
  });
}
