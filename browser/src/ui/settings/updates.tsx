import { useEffect, useRef, useState } from "react";
import { Box, Path, Text } from "@zenbu-labs/pixel";
import { Icon, arcPath } from "../icons";
import { mix, withAlpha } from "../theme";
import type { Theme } from "../theme";
import type { AboutView, SettingsActions, UpdateView } from "../types";
import { TextButton } from "./controls";
import { copy } from "./copy";
import { SettingBlock } from "./block";

export function UpdatesBlock({
  about,
  actions,
  rem,
  theme,
}: {
  about: AboutView;
  actions: SettingsActions;
  rem: number;
  theme: Theme;
}) {
  return (
    <SettingBlock
      label={copy.updates.version(about.version)}
      control={<UpdateControl about={about} actions={actions} rem={rem} theme={theme} />}
      rem={rem}
      theme={theme}
    />
  );
}

function UpdateControl({
  about,
  actions,
  rem,
  theme,
}: {
  about: AboutView;
  actions: SettingsActions;
  rem: number;
  theme: Theme;
}) {
  const update = about.update;
  if (!update) {
    if (about.canCheck) {
      return <TextButton label={copy.updates.check} rem={rem} theme={theme} onClick={actions.updateCheck} />;
    }
    if (about.canMock) {
      return (
        <TextButton label={copy.updates.mock} rem={rem} theme={theme} onClick={() => actions.updateMock(false)} />
      );
    }
    return null;
  }
  switch (update.state) {
    case "checking":
      return <Progress view={update} label={copy.updates.checking} rem={rem} theme={theme} />;
    case "downloading":
      return (
        <Progress
          view={update}
          label={update.percent == null ? copy.updates.downloading : `${update.percent}%`}
          rem={rem}
          theme={theme}
        />
      );
    case "available":
      return (
        <AccentButton
          label={copy.updates.download(update.version ?? "")}
          icon
          rem={rem}
          theme={theme}
          onClick={actions.updateDownload}
        />
      );
    case "staged":
      return <AccentButton label={copy.updates.restart} rem={rem} theme={theme} onClick={actions.updateRestart} />;
    case "restarting":
      return (
        <Text style={{ fontSize: rem * 0.85, color: theme.muted, wrap: false, selectable: false }}>
          {copy.updates.restarting}
        </Text>
      );
  }
}

function AccentButton({
  label,
  icon,
  rem,
  theme,
  onClick,
}: {
  label: string;
  icon?: boolean;
  rem: number;
  theme: Theme;
  onClick(): void;
}) {
  return (
    <Box
      style={{
        height: rem * 1.55,
        alignItems: "center",
        gap: rem * 0.4,
        padding: { left: rem * 0.7, right: rem * 0.7 },
        cornerRadius: rem * 0.3,
        background: mix(theme.accent, theme.bg, 0.12),
        hoverBackground: theme.accent,
        border: { width: 1, color: withAlpha(theme.accent, 160) },
        flexShrink: 0,
      }}
      onClick={onClick}
    >
      {icon && <Icon icon="download" size={rem * 0.85} color={[255, 255, 255, 255]} weight={2.4} />}
      <Text style={{ fontSize: rem * 0.85, color: [255, 255, 255, 255], wrap: false, selectable: false }}>
        {label}
      </Text>
    </Box>
  );
}

function useSmoothPercent(target: number, active: boolean): number {
  const [shown, setShown] = useState(0);
  const s = useRef({ shown: 0, target: 0 }).current;
  s.target = target;
  useEffect(() => {
    if (!active) {
      s.shown = 0;
      setShown(0);
      return;
    }
    const timer = setInterval(() => {
      const delta = s.target - s.shown;
      s.shown = Math.abs(delta) < 0.2 ? s.target : s.shown + delta * 0.15;
      setShown(s.shown);
    }, 16);
    return () => clearInterval(timer);
  }, [active]);
  return active ? shown : target;
}

function useSpinner(active: boolean): number {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setAngle((a) => (a + 5) % 360), 16);
    return () => clearInterval(timer);
  }, [active]);
  return active ? angle : 0;
}

// A brew-run download and a manifest check report no bytes, so the ring spins
// instead of filling.
function Progress({ view, label, rem, theme }: { view: UpdateView; label: string; rem: number; theme: Theme }) {
  const downloading = view.state === "downloading";
  const indeterminate = !downloading || view.percent == null;
  const percent = useSmoothPercent(view.percent ?? 0, downloading && !indeterminate);
  const spin = useSpinner(indeterminate);
  const d = rem * 1.3;
  const from = indeterminate ? -90 + spin : -90;
  const sweep = indeterminate ? 100 : Math.max(12, (percent / 100) * 360);
  return (
    <Box style={{ alignItems: "center", gap: rem * 0.5, flexShrink: 0 }}>
      <Box style={{ width: d, height: d, alignItems: "center", justifyContent: "center" }}>
        <Path
          d={arcPath(12, 12, 10.4, from, from + sweep)}
          viewBox={24}
          stroke={{ width: 2.4, color: theme.accent, cap: "round" }}
          style={{ position: "absolute", inset: { top: 0, left: 0 }, width: d, height: d }}
        />
        <Icon icon="download" size={rem * 0.7} color={theme.muted} weight={2.4} />
      </Box>
      <Text style={{ fontSize: rem * 0.85, color: theme.muted, wrap: false, selectable: false }}>{label}</Text>
    </Box>
  );
}
