import { Box, Text } from "@zenbu-labs/pixel";
import type { Theme } from "../theme";
import type { AboutView } from "../types";
import { copy } from "./copy";

export function AboutBlock({ about, rem, theme }: { about: AboutView; rem: number; theme: Theme }) {
  const facts: [string, string][] = [
    [copy.about.version, about.version],
    [copy.about.channel, about.channel],
    [copy.about.chromium, about.chromium],
    [copy.about.node, about.node],
  ];
  return (
    <Box style={{ flexShrink: 0, padding: { left: rem * 1, right: rem * 1, top: rem * 0.6, bottom: rem * 0.3 } }}>
      <Box
        style={{
          flexGrow: 1,
          flexBasis: 0,
          flexDirection: "column",
          gap: rem * 0.2,
          padding: { top: rem * 0.45, bottom: rem * 0.45, left: rem * 0.65, right: rem * 0.65 },
          cornerRadius: rem * 0.3,
          background: theme.field,
          border: { width: 1, color: theme.fieldBorder },
        }}
      >
        {facts
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <Box key={key} style={{ alignItems: "center", gap: rem * 0.6, height: rem * 1.15 }}>
              <Text style={{ width: rem * 5, fontSize: rem * 0.8, color: theme.muted, wrap: false, selectable: false }}>
                {key}
              </Text>
              <Text style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, fontSize: rem * 0.8, wrap: false, ellipsis: true }}>
                {value}
              </Text>
            </Box>
          ))}
      </Box>
    </Box>
  );
}
