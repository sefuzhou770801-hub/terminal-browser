import { Box } from "@zenbu-labs/pixel";
import type { Theme } from "../theme";

export function Divider({ rem, theme }: { rem: number; theme: Theme }) {
  return (
    <Box
      style={{
        height: 1,
        flexShrink: 0,
        margin: { left: rem * 1, right: rem * 1, top: rem * 0.3, bottom: rem * 0.3 },
        background: theme.hairline,
      }}
    />
  );
}
