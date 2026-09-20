import { Box, Text } from "@zenbu-labs/pixel";
import type { Theme } from "../theme";
import type { SettingsActions, SettingsView } from "../types";
import { copy } from "./copy";
import { ScrollPane } from "./scroll-pane";
import { AboutBlock } from "./about";
import { TextButton } from "./controls";
import { Divider } from "./divider";
import { CopyIcon, useCopiedFlash } from "./copied";

export function AdvancedPane({
  view,
  actions,
  rem,
  theme,
}: {
  view: SettingsView;
  actions: SettingsActions;
  rem: number;
  theme: Theme;
}) {
  return (
    <>
      <ScrollPane
        rem={rem}
        resetKey={0}
        style={{
          flexGrow: 1,
          flexBasis: 0,
          flexDirection: "column",
          padding: { top: rem * 0.3, bottom: rem * 0.8 },
        }}
      >
        <AboutBlock about={view.about} rem={rem} theme={theme} />
        <Divider rem={rem} theme={theme} />
        <Box
          style={{
            flexDirection: "column",
            gap: rem * 0.8,
            padding: { top: rem * 0.3, left: rem * 1, right: rem * 1 },
          }}
        >
          <PathLine
            header={copy.files.settings}
            path={view.files.settings}
            rem={rem}
            theme={theme}
            onCopy={() => actions.copyPath("settings")}
          />
          <PathLine
            header={copy.files.keybindings}
            path={view.files.keybindings}
            rem={rem}
            theme={theme}
            onCopy={() => actions.copyPath("keybindings")}
          />
          <Box style={{ margin: { top: rem * 0.3 } }}>
            <TextButton label={copy.reload} rem={rem} theme={theme} onClick={actions.reloadConfig} />
          </Box>
        </Box>
      </ScrollPane>
    </>
  );
}

function PathLine({
  header,
  path,
  rem,
  theme,
  onCopy,
}: {
  header: string;
  path: string;
  rem: number;
  theme: Theme;
  onCopy(): void;
}) {
  const [copied, flash] = useCopiedFlash();
  return (
    <Box style={{ flexDirection: "column", gap: rem * 0.25 }}>
      <Text
        style={{
          fontSize: rem * 0.75,
          color: theme.muted,
          wrap: false,
          selectable: false,
        }}
      >
        {header}
      </Text>
      <Box style={{ alignItems: "center", gap: rem * 0.4 }}>
        <Text style={{ fontSize: rem * 0.85, wrap: false }}>{path}</Text>
        <Box
          style={{
            width: rem * 1.3,
            height: rem * 1.3,
            alignItems: "center",
            justifyContent: "center",
            cornerRadius: rem * 0.3,
            hoverBackground: theme.hover,
          }}
          onClick={() => {
            onCopy();
            flash();
          }}
        >
          <CopyIcon copied={copied} size={rem * 0.8} theme={theme} />
        </Box>
      </Box>
    </Box>
  );
}
