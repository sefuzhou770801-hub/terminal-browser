import type { Theme } from "../theme";
import type { SettingsActions } from "../types";
import { SettingBlock } from "./block";
import { TextButton } from "./controls";
import { copy } from "./copy";

// The README's invite; swap for a permanent one before shipping.
const DISCORD_URL = "https://discord.gg/t3jzHHfc6z";

export function HelpBlock({ actions, rem, theme }: { actions: SettingsActions; rem: number; theme: Theme }) {
  return (
    <SettingBlock
      label={copy.help.label}
      hint={copy.help.hint}
      control={
        <TextButton label={copy.help.discord} rem={rem} theme={theme} onClick={() => actions.openLink(DISCORD_URL)} />
      }
      rem={rem}
      theme={theme}
    />
  );
}
