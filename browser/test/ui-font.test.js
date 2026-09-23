const assert = require("node:assert/strict");
const { test } = require("node:test");

const { registerUiFont, uiFontCandidates } = require("../dist/fonts.js");
const { displayWidth } = require("../dist/ui/text-width.js");

const MAPLE = "/home/me/Library/Fonts/MapleMono-CN-Regular.ttf";
const HIRAGINO = "/System/Library/Fonts/Hiragino Sans GB.ttc";
const BUNDLED = "/app/assets/fonts/JetBrainsMono-Regular.ttf";

test("prefers a font with Chinese glyphs and keeps the bundled font last", () => {
  const present = new Set([MAPLE, HIRAGINO]);
  const files = uiFontCandidates({}, BUNDLED, (file) => present.has(file), "/home/me");
  assert.deepEqual(files, [MAPLE, HIRAGINO, BUNDLED]);
});

test("an explicit font setting comes first, missing fonts are skipped", () => {
  const present = new Set(["/fonts/custom.ttf"]);
  const files = uiFontCandidates(
    { TERMINAL_BROWSER_UI_FONT: "/fonts/custom.ttf" },
    BUNDLED,
    (file) => present.has(file),
    "/home/me",
  );
  assert.deepEqual(files, ["/fonts/custom.ttf", BUNDLED]);
});

test("falls through to the next font when one fails to load", async () => {
  const font = await registerUiFont([MAPLE, BUNDLED], async (file) => {
    if (file === MAPLE) throw new Error("unreadable");
    return 7;
  });
  assert.deepEqual(font, { id: 7, file: BUNDLED });
});

test("Chinese characters take two columns", () => {
  assert.equal(displayWidth("inspect"), 7);
  assert.equal(displayWidth("关闭窗格"), 8);
  assert.equal(displayWidth("发送给 agent"), 12);
});
