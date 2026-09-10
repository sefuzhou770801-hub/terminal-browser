#!/bin/bash
# Points this repo at a local checkout of terminal-electron instead of the npm
# release, for working on both at once. Run again after changing the library;
# `--unlink` puts the npm dependency back.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="${TERMINAL_ELECTRON_DIR:-$ROOT/../terminal-electron}"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) TARGET=darwin-arm64 ;;
  Darwin-x86_64) TARGET=darwin-x64 ;;
  Linux-x86_64|Linux-amd64) TARGET=linux-x64 ;;
  Linux-aarch64|Linux-arm64) TARGET=linux-arm64 ;;
  *) echo "unsupported host: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

if [ "${1:-}" = "--unlink" ]; then
  node -e '
    const fs = require("fs");
    for (const file of ["browser/package.json", "cli/package.json"]) {
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      pkg.dependencies["terminal-electron"] = "0.0.11";
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
    }
    const root = JSON.parse(fs.readFileSync("package.json", "utf8"));
    if (root.pnpm) { delete root.pnpm.overrides; if (!Object.keys(root.pnpm).length) delete root.pnpm; }
    fs.writeFileSync("package.json", JSON.stringify(root, null, 2) + "\n");
  '
  cd "$ROOT" && pnpm install
  echo "back on the npm release of terminal-electron"
  exit 0
fi

LIB="$(cd "$LIB" && pwd)"
[ -f "$LIB/packages/terminal-electron/package.json" ] || { echo "no terminal-electron checkout at $LIB (set TERMINAL_ELECTRON_DIR)" >&2; exit 1; }

(cd "$LIB" && pnpm --filter terminal-electron build && pnpm --filter terminal-electron build:native -- --release)

# file: copies the package into node_modules, so its imports of react and electron
# resolve here rather than in the library repo (a symlink would give two Reacts).
node -e '
  const fs = require("fs"), path = require("path");
  const lib = process.argv[1], target = process.argv[2];
  const rel = (from, to) => "file:" + path.relative(path.resolve(from), to);
  for (const file of ["browser/package.json", "cli/package.json"]) {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.dependencies["terminal-electron"] = rel(path.dirname(file), `${lib}/packages/terminal-electron`);
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  }
  const root = JSON.parse(fs.readFileSync("package.json", "utf8"));
  root.pnpm = root.pnpm ?? {};
  root.pnpm.overrides = { ...(root.pnpm.overrides ?? {}), [`terminal-electron-native-${target}`]: rel(".", `${lib}/packages/native/${target}`) };
  fs.writeFileSync("package.json", JSON.stringify(root, null, 2) + "\n");
' "$LIB" "$TARGET"
cd "$ROOT" && pnpm install
echo "linked to $LIB (package.json now points at it; ./scripts/link-terminal-electron.sh --unlink to go back)"
