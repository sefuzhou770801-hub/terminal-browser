const assert = require("node:assert/strict");
const { test } = require("node:test");

const { closablePane, closeOwnPane } = require("../dist/session/own-pane.js");

const env = { HERDR_PANE_ID: "w1:p2", HERDR_BIN_PATH: "/opt/herdr" };

function fakeHerdr({ shellPid = 42, shellTty = "ttys005" } = {}) {
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    if (args[1] === "process-info") {
      return JSON.stringify({ result: { process_info: { shell_pid: shellPid } } });
    }
    if (command === "ps") return `${shellTty}\n`;
    return "{}";
  };
  return { run, calls };
}

test("offers the pane only for a herdr pane split off for the browser", () => {
  assert.deepEqual(closablePane("herdr", env, true), { bin: "/opt/herdr", id: "w1:p2" });
  assert.equal(closablePane("herdr", env, false), null);
  assert.equal(closablePane("tmux", env, true), null);
  assert.equal(closablePane(null, env, true), null);
  assert.equal(closablePane("herdr", {}, true), null);
  assert.equal(closablePane("herdr", { HERDR_PANE_ID: "w1:p2" }, true).bin, "herdr");
});

test("closes the pane whose shell shares the browser's tty", async () => {
  const herdr = fakeHerdr();
  await closeOwnPane({ bin: "/opt/herdr", id: "w1:p2" }, "/dev/ttys005", herdr.run);
  assert.deepEqual(herdr.calls.at(-1), ["/opt/herdr", "pane", "close", "w1:p2"]);
});

test("refuses to close a pane running on another tty", async () => {
  const herdr = fakeHerdr({ shellTty: "ttys009" });
  await assert.rejects(closeOwnPane({ bin: "/opt/herdr", id: "w1:p2" }, "/dev/ttys005", herdr.run));
  assert.ok(!herdr.calls.some((call) => call.includes("close")));
});

test("refuses to close when the pane or tty is unknown", async () => {
  const noShell = fakeHerdr({ shellPid: null });
  await assert.rejects(closeOwnPane({ bin: "herdr", id: "w1:p2" }, "/dev/ttys005", noShell.run));
  assert.ok(!noShell.calls.some((call) => call.includes("close")));

  const noTty = fakeHerdr();
  await assert.rejects(closeOwnPane({ bin: "herdr", id: "w1:p2" }, null, noTty.run));
  assert.equal(noTty.calls.length, 0);
});
