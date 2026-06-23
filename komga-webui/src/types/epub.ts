export interface TocEntry {
  title: string,
  href?: string,
  children?: TocEntry[],
  current?: boolean,
  level?: number,
}

export interface EpubThemeVariant {
  background: string,
  text: string,
  uiChrome: string,
  swatch: string,
  highlight: string,
}

export interface EpubTheme {
  // 20 themes inspired by popular terminal/editor color palettes - too many to usefully
  // pin as a string literal union, so just a plain id.
  id: string,
  label: string,
  light: EpubThemeVariant,
  dark: EpubThemeVariant,
}

export type EpubThemeId = string
