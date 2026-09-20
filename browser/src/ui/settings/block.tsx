import { Box, Text } from "@zenbu-labs/pixel";
import type { ReactNode } from "react";
import type { Theme } from "../theme";

// The same frame every general row uses: label line with its control on the
// right, optional hint under it, then whatever the row needs below.
export function SettingBlock({
  label,
  hint,
  control,
  rem,
  theme,
  children,
}: {
  label: string;
  hint?: string;
  control?: ReactNode;
  rem: number;
  theme: Theme;
  children?: ReactNode;
}) {
  return (
    <Box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        minWidth: 0,
        gap: rem * 0.35,
        padding: { left: rem * 1, right: rem * 1, top: rem * 0.55, bottom: rem * 0.55 },
      }}
    >
      <Box style={{ alignItems: "center", gap: rem * 0.4, height: rem * 1.55 }}>
        <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: rem * 0.92, wrap: false, selectable: false }}>
          {label}
        </Text>
        {control}
      </Box>
      {hint && (
        <Text style={{ fontSize: rem * 0.75, color: theme.muted, wrap: false, ellipsis: true, selectable: false }}>
          {hint}
        </Text>
      )}
      {children}
    </Box>
  );
}
