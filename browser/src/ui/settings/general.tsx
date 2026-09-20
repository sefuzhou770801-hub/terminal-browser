import { useState } from "react";
import type { ReactNode } from "react";
import { Box, Image, Input, Text } from "@zenbu-labs/pixel";
import { Icon } from "../icons";
import { withAlpha } from "../theme";
import type { Theme } from "../theme";
import type { SettingChoiceView, SettingRow, SettingsActions, SettingsView } from "../types";
import { copy } from "./copy";
import { ScrollPane } from "./scroll-pane";
import { IconButton } from "./controls";

const TILES_PER_ROW = 4;

export function GeneralPane({
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
    <ScrollPane
      rem={rem}
      resetKey={view.settings.length}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "column",
        padding: { top: rem * 0.6, bottom: rem * 0.8 },
      }}
    >
      {view.settings.map((row) => (
        <SettingLine key={row.key} row={row} actions={actions} rem={rem} theme={theme} />
      ))}
    </ScrollPane>
  );
}

function SettingLine({
  row,
  actions,
  rem,
  theme,
}: {
  row: SettingRow;
  actions: SettingsActions;
  rem: number;
  theme: Theme;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        minWidth: 0,
        gap: rem * 0.35,
        padding: { left: rem * 1, right: rem * 1, top: rem * 0.55, bottom: rem * 0.55 },
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Box style={{ alignItems: "center", gap: rem * 0.4, height: rem * 1.35 }}>
        <Text
          style={{
            flexGrow: 1,
            flexBasis: 0,
            fontSize: rem * 0.92,
            wrap: false,
            selectable: false,
          }}
        >
          {row.label}
        </Text>
        {hover && row.modified && (
          <IconButton
            icon="reload"
            rem={rem}
            theme={theme}
            onClick={() => actions.reset(row.key)}
          />
        )}
      </Box>
      {row.kind === "choice" && (
        <ChoiceTiles
          choices={row.choices}
          value={row.value}
          rem={rem}
          theme={theme}
          onPick={(value) => actions.set(row.key, value)}
        />
      )}
      {row.kind === "choice" ? (
        <Advanced
          open={!row.choices.some((choice) => choice.value === row.value)}
          rem={rem}
          theme={theme}
        >
          <TemplateField row={row} actions={actions} rem={rem} theme={theme} />
          {row.hint && <Hint text={row.hint} rem={rem} theme={theme} />}
          {row.link && (
            <Link url={row.link} rem={rem} theme={theme} onClick={() => actions.openLink(row.link!)} />
          )}
        </Advanced>
      ) : (
        <>
          {row.kind === "string" && (
            <TemplateField row={row} actions={actions} rem={rem} theme={theme} />
          )}
          {row.hint && <Hint text={row.hint} rem={rem} theme={theme} />}
        </>
      )}
    </Box>
  );
}

function TemplateField({
  row,
  actions,
  rem,
  theme,
}: {
  row: SettingRow & { value: string };
  actions: SettingsActions;
  rem: number;
  theme: Theme;
}) {
  return (
    <Box
      style={{
        height: rem * 1.7,
        alignItems: "center",
        padding: { left: rem * 0.55, right: rem * 0.55 },
        cornerRadius: rem * 0.3,
        background: theme.field,
        border: { width: 1, color: row.modified ? withAlpha(theme.accent, 150) : theme.fieldBorder },
      }}
    >
      <Input
        key={row.value}
        defaultValue={row.value}
        style={{ flexGrow: 1, flexBasis: 0, wrap: false, fontSize: rem * 0.85 }}
        caretColor={theme.accent}
        selectionColor={theme.selection}
        onChange={(text) => actions.draft(row.key, text)}
        onSubmit={(text) => actions.set(row.key, text)}
      />
    </Box>
  );
}

function Hint({ text, rem, theme }: { text: string; rem: number; theme: Theme }) {
  return (
    <Box style={{ minWidth: 0 }}>
      <Text
        style={{
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 0,
          fontSize: rem * 0.75,
          color: theme.muted,
          wrap: false,
          ellipsis: true,
          selectable: false,
        }}
      >
        {text}
      </Text>
    </Box>
  );
}

function Link({
  url,
  rem,
  theme,
  onClick,
}: {
  url: string;
  rem: number;
  theme: Theme;
  onClick(): void;
}) {
  return (
    <Box style={{ minWidth: 0 }}>
      <Text
        style={{
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 0,
          fontSize: rem * 0.75,
          color: withAlpha(theme.accent, 200),
          wrap: false,
          ellipsis: true,
          selectable: false,
        }}
        onClick={onClick}
      >
        {url}
      </Text>
    </Box>
  );
}

function ChoiceTiles({
  choices,
  value,
  rem,
  theme,
  onPick,
}: {
  choices: SettingChoiceView[];
  value: string;
  rem: number;
  theme: Theme;
  onPick(value: string): void;
}) {
  const rows: SettingChoiceView[][] = [];
  for (let i = 0; i < choices.length; i += TILES_PER_ROW) {
    rows.push(choices.slice(i, i + TILES_PER_ROW));
  }
  return (
    <Box style={{ flexDirection: "column", gap: rem * 0.35, margin: { top: rem * 0.1 } }}>
      {rows.map((tiles, index) => (
        <Box key={index} style={{ gap: rem * 0.35 }}>
          {tiles.map((choice) => (
            <ChoiceTile
              key={choice.value}
              choice={choice}
              selected={choice.value === value}
              rem={rem}
              theme={theme}
              onClick={() => onPick(choice.value)}
            />
          ))}
          {Array.from({ length: TILES_PER_ROW - tiles.length }, (_, i) => (
            <Box key={`pad-${i}`} style={{ flexGrow: 1, flexBasis: 0 }} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

function ChoiceTile({
  choice,
  selected,
  rem,
  theme,
  onClick,
}: {
  choice: SettingChoiceView;
  selected: boolean;
  rem: number;
  theme: Theme;
  onClick(): void;
}) {
  return (
    <Box
      style={{
        flexGrow: 1,
        flexBasis: 0,
        height: rem * 2.1,
        alignItems: "center",
        gap: rem * 0.5,
        padding: { left: rem * 0.6, right: rem * 0.6 },
        cornerRadius: rem * 0.35,
        background: selected ? withAlpha(theme.accent, 40) : theme.field,
        hoverBackground: selected ? withAlpha(theme.accent, 60) : theme.hoverStrong,
        border: { width: 1, color: selected ? theme.accent : theme.fieldBorder },
      }}
      onClick={onClick}
    >
      <ChoiceMark choice={choice} size={rem * 1.15} theme={theme} />
      <Text
        style={{
          flexGrow: 1,
          flexBasis: 0,
          fontSize: rem * 0.88,
          color: selected ? theme.fg : theme.muted,
          wrap: false,
          selectable: false,
        }}
      >
        {choice.name}
      </Text>
    </Box>
  );
}

function ChoiceMark({
  choice,
  size,
  theme,
}: {
  choice: SettingChoiceView;
  size: number;
  theme: Theme;
}) {
  if (!choice.logo) return <Icon icon="close" size={size} color={theme.muted} />;
  return (
    <Image
      src={choice.logo}
      error={<Box style={{ width: size, height: size }} />}
      style={{ width: size, height: size, cornerRadius: size * 0.2, flexShrink: 0 }}
    />
  );
}

function Advanced({
  open: forcedOpen,
  rem,
  theme,
  children,
}: {
  open: boolean;
  rem: number;
  theme: Theme;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open || forcedOpen;
  return (
    <Box style={{ flexDirection: "column", gap: rem * 0.35 }}>
      <Box style={{ height: rem * 1.2 }}>
        <Box
          style={{ alignItems: "center", gap: rem * 0.25 }}
          onClick={() => setOpen(!shown)}
        >
          <Icon icon={shown ? "down" : "forward"} size={rem * 0.8} color={theme.muted} />
          <Text style={{ fontSize: rem * 0.78, color: theme.muted, wrap: false, selectable: false }}>
            {copy.advanced}
          </Text>
        </Box>
      </Box>
      {shown && children}
    </Box>
  );
}
