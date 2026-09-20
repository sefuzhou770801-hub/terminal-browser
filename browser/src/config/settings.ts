import { z } from "zod";

import { SEARCH_ENGINES, SUGGESTIONS_OFF } from "./search";

export interface SettingChoice {
  value: string;
  name: string;
  logo: string | null;
}

interface SettingDef<S extends z.ZodType> {
  label: string;
  hint?: string;
  link?: string;
  schema: S;
  default: z.infer<S>;
  choices?: SettingChoice[];
}

function setting<S extends z.ZodType>(def: SettingDef<S>): SettingDef<S> {
  return def;
}

export const SETTINGS = {
  "search.engine": setting({
    label: "search engine",
    hint: "%s is replaced with search text",
    schema: z.string(),
    default: SEARCH_ENGINES[0].search,
    choices: SEARCH_ENGINES.map(({ search, name, logo }) => ({ value: search, name, logo })),
  }),
  "search.suggestions": setting({
    label: "search suggestions",
    hint: "%s is replaced with search text",
    link: "https://github.com/dewitt/opensearch/blob/master/mediawiki/Specifications/OpenSearch/Extensions/Suggestions/1.1/Draft%201.wiki",
    schema: z.string(),
    default: SEARCH_ENGINES[0].suggest!,
    choices: [
      ...SEARCH_ENGINES.filter((engine) => engine.suggest).map(({ suggest, name, logo }) => ({
        value: suggest!,
        name,
        logo,
      })),
      { value: SUGGESTIONS_OFF, name: "off", logo: null },
    ],
  }),
};

export type SettingKey = keyof typeof SETTINGS;

export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]["schema"]> };

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(value: string): value is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, value);
}

export function defaultSettings(): Settings {
  const out = {} as Record<string, unknown>;
  for (const key of SETTING_KEYS) out[key] = SETTINGS[key].default;
  return out as Settings;
}
