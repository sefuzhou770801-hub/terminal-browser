const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { checkTerminal, detect } = require("../dist/index.js");

const FIXTURES = path.join(__dirname, "fixtures");

/** Answers from recorded output, and remembers what was asked. */
function recorder(exec) {
  const commands = [];
  const run = async (bin, args) => {
    const command = [bin, ...args].join(" ");
    commands.push(command);
    const output = exec[command];
    if (output === undefined) throw new Error(`nothing recorded for: ${command}`);
    return output;
  };
  return { run, commands };
}

for (const file of fs.readdirSync(FIXTURES)) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
  const { env, exec, expect } = fixture;

  test(`${expect.name}: knows which pane it is in`, async () => {
    const { run } = recorder(exec);
    const terminal = detect(env, run);
    assert.equal(terminal?.name, expect.name);
    assert.deepEqual(await terminal.getCurrentPane({ tty: null, cwd: "/" }), expect.currentPane);
  });

  test(`${expect.name}: opens a split`, async () => {
    const { run, commands } = recorder(exec);
    const terminal = detect(env, run);
    await terminal.split(expect.split.request);
    assert.deepEqual(commands, expect.split.commands);
  });
}

test("an unknown terminal is nobody", () => {
  assert.equal(detect({ TERM: "xterm-256color" }, async () => ""), null);
});

test("vscode draws but cannot open panes", () => {
  const terminal = detect({ TERM_PROGRAM: "vscode" }, async () => "");
  assert.equal(terminal?.name, "vscode");
  assert.equal(terminal?.split, undefined);
});

// there is no tty here, so nothing answers and recognising the terminal is all we have
test("a terminal we know draws when the tty will not say, a stranger does not", async () => {
  const known = await checkTerminal(detect({ TERM_PROGRAM: "vscode" }, async () => ""), {});
  assert.equal(known.graphics, "supported");
  const stranger = await checkTerminal(detect({ TERM: "xterm-256color" }, async () => ""), {});
  assert.equal(stranger.graphics, "unsupported");
});

test("a multiplexer wins over the terminal it runs in", () => {
  const terminal = detect({ TMUX: "/tmp/x,1,0", TERM_PROGRAM: "ghostty" }, async () => "");
  assert.equal(terminal?.name, "tmux");
});

// a terminal opened from ghostty inherits every ghostty variable, and answering "ghostty"
// there sends apple events from the wrong app — which macOS asks the person to allow
test("a pane variable beats the variables the terminal was launched with", () => {
  const terminal = detect(
    {
      TTY7_PANE: "%3",
      TERM: "xterm-ghostty",
      TERM_PROGRAM: "ghostty",
      GHOSTTY_RESOURCES_DIR: "/Applications/Ghostty.app/Contents/Resources/ghostty",
    },
    async () => "",
  );
  assert.equal(terminal?.name, "tty7");
});

// both draw with ghostty's engine and report ghostty everywhere they can
const GHOSTTY_LOOKALIKE = {
  TERM: "xterm-ghostty",
  TERM_PROGRAM: "ghostty",
  GHOSTTY_RESOURCES_DIR: "/Applications/Ghostty.app/Contents/Resources/ghostty",
};

test("cmux is told apart from ghostty by its own variable", () => {
  const env = { ...GHOSTTY_LOOKALIKE, CMUX_SURFACE_ID: "1E1B…", CMUX_SOCKET_PATH: "/tmp/c.sock" };
  assert.equal(detect(env, async () => "")?.name, "cmux");
});

test("supacode is told apart from ghostty by its own variable", () => {
  const env = { ...GHOSTTY_LOOKALIKE, SUPACODE_SURFACE_ID: "9A2F…" };
  assert.equal(detect(env, async () => "")?.name, "supacode");
});

test("plain ghostty is still ghostty", () => {
  assert.equal(detect(GHOSTTY_LOOKALIKE, async () => "")?.name, "ghostty");
});

test("herdr falls back when the running herdr predates --right-click", async () => {
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_TAB_ID: "w1:t1" };
  const commands = [];
  const run = async (bin, args) => {
    commands.push([bin, ...args].join(" "));
    if (args.includes("--right-click")) {
      const error = new Error("unknown option: --right-click");
      error.stderr = "unknown option: --right-click\n";
      throw error;
    }
    if (args[0] === "pane" && args[1] === "split") {
      return JSON.stringify({ result: { pane: { pane_id: "w1:p2" } } });
    }
    return "";
  };
  await detect(env, run).split({
    from: { id: "w1:p1", tab: "w1:t1" },
    direction: "right",
    command: ["terminal-browser", "open"],
    size: null,
    tty: null,
  });
  assert.deepEqual(commands, [
    "herdr pane split --pane w1:p1 --direction right --focus --right-click pane",
    "herdr pane split --pane w1:p1 --direction right --focus",
    "herdr pane run w1:p2 terminal-browser open",
  ]);
});

function tempHerdrConfig(initialContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-cfg-"));
  const configPath = path.join(dir, "config.toml");
  if (initialContent !== null) fs.writeFileSync(configPath, initialContent);
  return configPath;
}

test("herdr prepare enables kitty graphics from a blank config", async () => {
  const configPath = tempHerdrConfig(null);
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const { run, commands } = recorder({
    "herdr server reload-config": JSON.stringify({ result: { status: "applied" } }),
  });
  await detect(env, run).prepare();
  assert.equal(fs.readFileSync(configPath, "utf8"), "[experimental]\nkitty_graphics = true\n");
  assert.deepEqual(commands, ["herdr server reload-config"]);
});

test("herdr prepare inserts into an existing experimental table instead of duplicating it", async () => {
  const configPath = tempHerdrConfig(
    "onboarding = false\n\n[experimental]\nreveal_hidden_cursor_for_cjk_ime = true\n",
  );
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const { run } = recorder({
    "herdr server reload-config": JSON.stringify({ result: { status: "applied" } }),
  });
  await detect(env, run).prepare();
  const content = fs.readFileSync(configPath, "utf8");
  assert.match(content, /\[experimental\]\nkitty_graphics = true\nreveal_hidden_cursor_for_cjk_ime = true/);
  assert.equal((content.match(/\[experimental\]/g) ?? []).length, 1);
});

test("herdr prepare flips an explicit kitty_graphics = false instead of duplicating the key", async () => {
  const configPath = tempHerdrConfig("[experimental]\nkitty_graphics = false\n");
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const { run } = recorder({
    "herdr server reload-config": JSON.stringify({ result: { status: "applied" } }),
  });
  await detect(env, run).prepare();
  assert.equal(fs.readFileSync(configPath, "utf8"), "[experimental]\nkitty_graphics = true\n");
});

test("herdr prepare leaves an already-enabled config alone and never reloads", async () => {
  const configPath = tempHerdrConfig("[experimental]\nkitty_graphics = true\n");
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const { run, commands } = recorder({});
  await detect(env, run).prepare();
  assert.deepEqual(commands, []);
});

test("herdr prepare stays silent when reload-config rejects the edit", async () => {
  const configPath = tempHerdrConfig(null);
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const { run } = recorder({
    "herdr server reload-config": JSON.stringify({
      result: { status: "failed", diagnostics: ["config parse error"] },
    }),
  });
  const originalError = console.error;
  const warnings = [];
  console.error = (message) => warnings.push(message);
  try {
    await assert.doesNotReject(detect(env, run).prepare());
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(warnings, []);
});

test("herdr prepare stays silent when herdr itself cannot be run", async () => {
  const configPath = tempHerdrConfig(null);
  const env = { HERDR_PANE_ID: "w1:p1", HERDR_CONFIG_PATH: configPath };
  const run = async () => {
    throw new Error("spawn herdr ENOENT");
  };
  const originalError = console.error;
  const warnings = [];
  console.error = (message) => warnings.push(message);
  try {
    await assert.doesNotReject(detect(env, run).prepare());
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(warnings, []);
});


const GHOSTTY_ENV = {
  TERM: "xterm-ghostty",
  TERM_PROGRAM: "ghostty",
  TERM_PROGRAM_VERSION: "1.3.1",
  GHOSTTY_RESOURCES_DIR: "/Applications/Ghostty.app/Contents/Resources/ghostty",
};
const GHOSTTY_BIN = "/Applications/Ghostty.app/Contents/MacOS/ghostty";
const processTable = (rows) => rows.map((row) => row.join(" ")).join("\n") + "\n";

// a test process lives under whatever launched node, so the pretend ghostty is grafted
// in as our own parent to get a shell -> ghostty ancestry without knowing the real tree
test("ghostty scripts the instance this shell runs inside, not the newest one", async () => {
  const { run, commands } = recorder({
    "ps -axo pid=,ppid=,tty=,command=": processTable([
      [process.pid, process.ppid, "ttys001", "node test"],
      [process.ppid, 1, "??", GHOSTTY_BIN],
      [9001, 1, "??", `${GHOSTTY_BIN} -e sh -c python3 probe.py`],
    ]),
    [`osascript -l JavaScript - ${process.ppid} list`]: "w1\tt1\tAAAA\t\t\t/Users/me\n",
    "ps -e -o pid=,tty=,args=": "",
  });
  const terminal = detect(GHOSTTY_ENV, run);
  assert.deepEqual(await terminal.listPanes(), [
    { id: "AAAA", tab: "w1:t1", tty: null, command: null },
  ]);
  assert.ok(commands.includes(`osascript -l JavaScript - ${process.ppid} list`));
});

test("ghostty falls back to the only instance when this shell is not inside one", async () => {
  const { run, commands } = recorder({
    "ps -axo pid=,ppid=,tty=,command=": processTable([
      [process.pid, 1, "ttys001", "node test"],
      [7000, 1, "??", GHOSTTY_BIN],
    ]),
    "osascript -l JavaScript - 7000 list": "w1\tt1\tAAAA\t\t\t/Users/me\n",
    "ps -e -o pid=,tty=,args=": "",
  });
  await detect(GHOSTTY_ENV, run).listPanes();
  assert.ok(commands.includes("osascript -l JavaScript - 7000 list"));
});

test("ghostty finds the instance through the caller tty when ancestry does not reach one", async () => {
  const { run, commands } = recorder({
    "ps -axo pid=,ppid=,tty=,command=": processTable([
      [process.pid, 1, "??", "node daemon"],
      [7000, 1, "??", GHOSTTY_BIN],
      [7001, 7000, "ttys009", "login"],
      [7002, 7001, "ttys009", "-zsh"],
      [8000, 1, "??", `${GHOSTTY_BIN} -e probe`],
    ]),
    "osascript -l JavaScript - 7000 list": "w1\tt1\tAAAA\t\t/dev/ttys009\t/Users/me\n",
  });
  const pane = await detect(GHOSTTY_ENV, run).getCurrentPane({ tty: "/dev/ttys009", cwd: "/" });
  assert.deepEqual(pane, { id: "AAAA", tab: "w1:t1", tty: "/dev/ttys009", command: null });
  assert.ok(commands.includes("osascript -l JavaScript - 7000 list"));
});

test("ghostty refuses to guess between instances it cannot connect to this shell", async () => {
  const { run } = recorder({
    "ps -axo pid=,ppid=,tty=,command=": processTable([
      [process.pid, 1, "ttys001", "node test"],
      [7000, 1, "??", GHOSTTY_BIN],
      [8000, 1, "??", `${GHOSTTY_BIN} -e probe`],
    ]),
  });
  await assert.rejects(detect(GHOSTTY_ENV, run).listPanes(), /2 Ghostty processes.*7000, 8000/);
});

test("ghostty splits through the owning instance with the direction code", async () => {
  const { run, commands } = recorder({
    "ps -axo pid=,ppid=,tty=,command=": processTable([
      [process.pid, process.ppid, "ttys001", "node test"],
      [process.ppid, 1, "??", GHOSTTY_BIN],
    ]),
    [`osascript -l JavaScript - ${process.ppid} split AAAA GSrt ${process.cwd()} terminal-browser open\n`]: "BBBB",
  });
  await detect(GHOSTTY_ENV, run).split({
    from: { id: "AAAA", tab: "w1:t1" },
    direction: "right",
    command: ["terminal-browser", "open"],
    size: null,
    tty: null,
  });
  assert.deepEqual(commands, [
    "ps -axo pid=,ppid=,tty=,command=",
    `osascript -l JavaScript - ${process.ppid} split AAAA GSrt ${process.cwd()} terminal-browser open\n`,
  ]);
});
