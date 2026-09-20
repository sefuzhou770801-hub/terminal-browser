import { Box, Text } from "@zenbu-labs/pixel";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import type { Theme } from "../theme";

export function IconButton({
  icon,
  rem,
  theme,
  onClick,
}: {
  icon: IconName;
  rem: number;
  theme: Theme;
  onClick(): void;
}) {
  return (
    <Box
      style={{
        width: rem * 1.25,
        height: rem * 1.25,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        cornerRadius: rem * 0.25,
        hoverBackground: theme.hoverStrong,
      }}
      onClick={onClick}
    >
      <Icon icon={icon} size={rem * 0.85} color={theme.muted} />
    </Box>
  );
}

export function TextButton({
  label,
  rem,
  theme,
  onClick,
}: {
  label: string;
  rem: number;
  theme: Theme;
  onClick(): void;
}) {
  return (
    <Box
      style={{
        height: rem * 1.55,
        alignItems: "center",
        padding: { left: rem * 0.7, right: rem * 0.7 },
        cornerRadius: rem * 0.3,
        background: theme.field,
        hoverBackground: theme.hoverStrong,
        border: { width: 1, color: theme.fieldBorder },
      }}
      onClick={onClick}
    >
      <Text style={{ fontSize: rem * 0.85, wrap: false, selectable: false }}>{label}</Text>
    </Box>
  );
}
