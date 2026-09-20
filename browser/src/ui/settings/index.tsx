import { Box, Text } from "@zenbu-labs/pixel";
import { Backdrop } from "../modals";
import type { Theme } from "../theme";
import type { ChromeLayout, SettingsActions, SettingsSection, SettingsView } from "../types";
import { copy } from "./copy";
import { RecordDialog } from "./record-dialog";
import { AgentBriefButton } from "./agent-brief-button";
import { ShortcutsPane } from "./shortcuts";
import { GeneralPane } from "./general";
import { AdvancedPane } from "./advanced";
import { IconButton } from "./controls";

const SECTIONS: SettingsSection[] = ["general", "shortcuts", "advanced"];

export function SettingsCard({
  view,
  actions,
  layout,
  theme,
}: {
  view: SettingsView;
  actions: SettingsActions;
  layout: ChromeLayout;
  theme: Theme;
}) {
  const rem = layout.rem;
  const width = Math.round(
    Math.min(layout.width - rem * 2, Math.max(layout.width * 0.75, rem * 56)),
  );
  const areaTop = layout.toolbarHeight;
  const areaHeight = layout.height - areaTop;
  const height = Math.round(
    Math.min(areaHeight - rem * 1.5, Math.max(areaHeight * 0.75, rem * 30)),
  );
  return (
    <>
      <Backdrop layout={layout} onClose={actions.close} />
      <Box
        style={{
          position: "absolute",
          inset: {
            top: Math.round(areaTop + (areaHeight - height) / 2),
            left: Math.round((layout.width - width) / 2),
          },
          width,
          height,
          flexDirection: "column",
          background: theme.overlay,
          cornerRadius: rem * 0.55,
          border: { width: 1, color: theme.fieldBorder },
          overflow: "hidden",
        }}
        onClick={() => {}}
        onWheel={() => {}}
      >
        <Box
          style={{
            height: rem * 2.3,
            flexShrink: 0,
            alignItems: "center",
            padding: { left: rem * 0.6, right: rem * 0.6 },
            border: { bottom: [1, theme.hairline] },
          }}
        >
          <Box style={{ width: rem * 1.25, flexShrink: 0 }} />
          <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, justifyContent: "center" }}>
            <Text style={{ fontSize: rem * 0.88, wrap: false, ellipsis: true, selectable: false }}>
              {copy.title(view.about.version)}
            </Text>
          </Box>
          <IconButton icon="close" rem={rem} theme={theme} onClick={actions.close} />
        </Box>
        <Box style={{ flexGrow: 1, flexBasis: 0, flexDirection: "row" }}>
        <Box
          style={{
            width: rem * 9,
            flexShrink: 0,
            flexDirection: "column",
            gap: rem * 0.15,
            padding: { top: rem * 0.6, left: rem * 0.5, right: rem * 0.5 },
            border: { right: [1, theme.hairline] },
          }}
        >
          {SECTIONS.map((section) => (
            <Box
              key={section}
              style={{
                height: rem * 1.9,
                alignItems: "center",
                padding: { left: rem * 0.8 },
                cornerRadius: rem * 0.35,
                background: section === view.section ? theme.hover : undefined,
                hoverBackground: theme.hover,
              }}
              onClick={() => actions.section(section)}
            >
              <Text
                style={{
                  fontSize: rem * 0.92,
                  color: section === view.section ? theme.fg : theme.muted,
                  wrap: false,
                  selectable: false,
                }}
              >
                {copy.sections[section]}
              </Text>
            </Box>
          ))}
          <Box style={{ flexGrow: 1, flexBasis: 0 }} />
          <AgentBriefButton rem={rem} theme={theme} onCopy={actions.copyAgentBrief} />
        </Box>
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, flexDirection: "column" }}>
          {view.section === "shortcuts" ? (
            <ShortcutsPane view={view} actions={actions} rem={rem} theme={theme} />
          ) : view.section === "advanced" ? (
            <AdvancedPane view={view} actions={actions} rem={rem} theme={theme} />
          ) : (
            <GeneralPane view={view} actions={actions} rem={rem} theme={theme} />
          )}
        </Box>
        </Box>
      </Box>
      {view.recording && (
        <RecordDialog
          keys={view.recording.keys}
          layout={layout}
          theme={theme}
          onCancel={actions.cancelRecording}
        />
      )}
    </>
  );
}
