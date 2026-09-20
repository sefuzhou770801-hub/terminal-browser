const assert = require("node:assert/strict");
const { test } = require("node:test");

const { isNewerVersion, releaseTarget } = require("../dist/release.js");

test("stable versions compare numerically and ignore a leading v", () => {
  assert.equal(isNewerVersion("0.33.0", "0.34.0", "stable"), true);
  assert.equal(isNewerVersion("0.33.0", "v0.33.1", "stable"), true);
  assert.equal(isNewerVersion("0.33.10", "0.33.9", "stable"), false);
  assert.equal(isNewerVersion("1.0.0", "1.0", "stable"), false);
  assert.equal(isNewerVersion("0.33.0", "0.33.0", "stable"), false);
});

test("dev channel treats any different version as newer", () => {
  assert.equal(isNewerVersion("main-abc123", "main-def456", "dev"), true);
  assert.equal(isNewerVersion("main-abc123", "main-abc123", "dev"), false);
});

test("release target names the running platform", () => {
  assert.match(releaseTarget(), /^(darwin|linux)-(arm64|x64)$/);
});
