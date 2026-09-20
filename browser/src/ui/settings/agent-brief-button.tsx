import { Box, Text } from "@zenbu-labs/pixel";
import type { Theme } from "../theme";
import { copy } from "./copy";
import { CopyIcon, useCopiedFlash } from "./copied";

export function AgentBriefButton({
  rem,
  theme,
  onCopy,
}: {
  rem: number;
  theme: Theme;
  onCopy(): void;
}) {
  const [copied, flash] = useCopiedFlash();
  const [first, second] = copy.agent;
  const label = { fontSize: rem * 0.78, color: theme.muted, wrap: false, selectable: false };
  return (
    <Box
      style={{
        flexDirection: "column",
        gap: rem * 0.05,
        padding: { left: rem * 0.8, right: rem * 0.5, top: rem * 0.3, bottom: rem * 0.3 },
        margin: { bottom: rem * 0.5 },
        cornerRadius: rem * 0.35,
        hoverBackground: theme.hover,
      }}
      onClick={() => {
        onCopy();
        flash();
      }}
    >
      <Text style={label}>{first}</Text>
      <Box style={{ alignItems: "center", gap: rem * 0.3 }}>
        <Text style={label}>{second}</Text>
        <CopyIcon copied={copied} size={rem * 0.85} theme={theme} />
      </Box>
    </Box>
  );
}
