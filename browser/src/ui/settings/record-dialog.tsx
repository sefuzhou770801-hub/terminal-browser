import { Box, Text } from "@zenbu-labs/pixel";
import { Backdrop } from "../modals";
import type { Theme } from "../theme";
import type { ChromeLayout } from "../types";
import { IconButton } from "./controls";
import { copy } from "./copy";

export function RecordDialog({
  keys,
  layout,
  theme,
  onCancel,
}: {
  keys: string;
  layout: ChromeLayout;
  theme: Theme;
  onCancel(): void;
}) {
  const rem = layout.rem;
  const width = Math.round(Math.min(layout.width - rem * 4, rem * 46));
  const height = Math.round(rem * 7.5);
  const areaTop = layout.toolbarHeight;
  return (
    <>
      <Backdrop layout={layout} onClose={onCancel} />
      <Box
        style={{
          position: "absolute",
          inset: {
            top: Math.round(areaTop + (layout.height - areaTop - height) / 2),
            left: Math.round((layout.width - width) / 2),
          },
          width,
          height,
          flexDirection: "column",
          background: theme.overlay,
          cornerRadius: rem * 0.55,
          border: { width: 1, color: theme.fieldBorder },
        }}
        onClick={() => {}}
        onWheel={() => {}}
      >
        <Box
          style={{
            flexGrow: 1,
            flexBasis: 0,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: rem * 0.9,
            padding: { left: rem * 1.2, right: rem * 1.2, bottom: rem * 0.4 },
          }}
        >
          <Box style={{ width: "100%", alignItems: "center", gap: rem * 0.5 }}>
            <Box style={{ width: rem * 1.25, flexShrink: 0 }} />
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: "center" }}>
              <Text style={{ fontSize: rem * 0.92, wrap: false, selectable: false }}>
                {copy.recordPrompt}
              </Text>
            </Box>
            <IconButton icon="close" rem={rem} theme={theme} onClick={onCancel} />
          </Box>
          <Box
            style={{
              width: "100%",
              height: rem * 2.2,
              alignItems: "center",
              justifyContent: "center",
              cornerRadius: rem * 0.3,
              background: theme.field,
              border: { width: 1, color: theme.accent },
            }}
          >
            <Text style={{ fontSize: rem * 1, wrap: false, selectable: false }}>{keys}</Text>
          </Box>
        </Box>
      </Box>
    </>
  );
}
