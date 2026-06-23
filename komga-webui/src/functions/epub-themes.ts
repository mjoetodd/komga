import {EpubTheme, EpubThemeId} from '@/types/epub'

// 20 themes inspired by popular terminal/editor color palettes, each with a light and dark
// variant. Highlight colors are a muted/pastel pull from each palette's characteristic
// accent rather than its full-saturation form, since it sits as a background behind text.
export const EPUB_THEMES: EpubTheme[] = [
  {
    id: 'dracula',
    label: 'Dracula',
    dark: {background: '#282A36', text: '#F8F8F2', uiChrome: '#343746', swatch: '#282A36', highlight: '#44475A'},
    light: {background: '#F8F8F2', text: '#282A36', uiChrome: '#E8E8E2', swatch: '#F8F8F2', highlight: '#D6C7F0'},
  },
  {
    id: 'nord',
    label: 'Nord',
    dark: {background: '#2E3440', text: '#D8DEE9', uiChrome: '#3B4252', swatch: '#2E3440', highlight: '#434C5E'},
    light: {background: '#ECEFF4', text: '#2E3440', uiChrome: '#E5E9F0', swatch: '#ECEFF4', highlight: '#B8C4D9'},
  },
  {
    id: 'solarized',
    label: 'Solarized',
    dark: {background: '#002B36', text: '#839496', uiChrome: '#073642', swatch: '#002B36', highlight: '#114B5C'},
    light: {background: '#FDF6E3', text: '#657B83', uiChrome: '#EEE8D5', swatch: '#FDF6E3', highlight: '#BFE6E0'},
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    dark: {background: '#282828', text: '#EBDBB2', uiChrome: '#3C3836', swatch: '#282828', highlight: '#504945'},
    light: {background: '#FBF1C7', text: '#3C3836', uiChrome: '#EBDBB2', swatch: '#FBF1C7', highlight: '#D5C4A1'},
  },
  {
    id: 'monokai',
    label: 'Monokai',
    dark: {background: '#272822', text: '#F8F8F2', uiChrome: '#3E3D32', swatch: '#272822', highlight: '#49483E'},
    light: {background: '#FAFAF0', text: '#272822', uiChrome: '#E8E8D8', swatch: '#FAFAF0', highlight: '#E6DB9A'},
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    dark: {background: '#282C34', text: '#ABB2BF', uiChrome: '#2C313A', swatch: '#282C34', highlight: '#3E4451'},
    light: {background: '#FAFAFA', text: '#383A42', uiChrome: '#EAEAEB', swatch: '#FAFAFA', highlight: '#DCDCE0'},
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    dark: {background: '#1A1B26', text: '#C0CAF5', uiChrome: '#232433', swatch: '#1A1B26', highlight: '#292E42'},
    light: {background: '#D5D6DB', text: '#343B58', uiChrome: '#E1E2E7', swatch: '#D5D6DB', highlight: '#C4C8DA'},
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    dark: {background: '#1E1E2E', text: '#CDD6F4', uiChrome: '#292C3C', swatch: '#1E1E2E', highlight: '#313244'},
    light: {background: '#EFF1F5', text: '#4C4F69', uiChrome: '#E6E9EF', swatch: '#EFF1F5', highlight: '#CCD0DA'},
  },
  {
    id: 'ayu',
    label: 'Ayu',
    dark: {background: '#0F1419', text: '#E6E1CF', uiChrome: '#1A1F29', swatch: '#0F1419', highlight: '#232B36'},
    light: {background: '#FAFAFA', text: '#5C6166', uiChrome: '#F0F0F0', swatch: '#FAFAFA', highlight: '#E6E1CF'},
  },
  {
    id: 'material',
    label: 'Material',
    dark: {background: '#263238', text: '#EEFFFF', uiChrome: '#2E3C43', swatch: '#263238', highlight: '#314549'},
    light: {background: '#FAFAFA', text: '#263238', uiChrome: '#ECEFF1', swatch: '#FAFAFA', highlight: '#CFD8DC'},
  },
  {
    id: 'night-owl',
    label: 'Night Owl',
    dark: {background: '#011627', text: '#D6DEEB', uiChrome: '#0B2942', swatch: '#011627', highlight: '#1D3B53'},
    light: {background: '#FBFBFB', text: '#403F53', uiChrome: '#E6E6E6', swatch: '#FBFBFB', highlight: '#D9D9D9'},
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    dark: {background: '#191724', text: '#E0DEF4', uiChrome: '#1F1D2E', swatch: '#191724', highlight: '#26233A'},
    light: {background: '#FAF4ED', text: '#575279', uiChrome: '#FFFAF3', swatch: '#FAF4ED', highlight: '#F3D9D8'},
  },
  {
    id: 'everforest',
    label: 'Everforest',
    dark: {background: '#2D353B', text: '#D3C6AA', uiChrome: '#343F44', swatch: '#2D353B', highlight: '#3D484D'},
    light: {background: '#F3EAD3', text: '#5C6A72', uiChrome: '#EFE3C8', swatch: '#F3EAD3', highlight: '#DDD0B0'},
  },
  {
    id: 'kanagawa',
    label: 'Kanagawa',
    dark: {background: '#1F1F28', text: '#DCD7BA', uiChrome: '#16161D', swatch: '#1F1F28', highlight: '#2A2A37'},
    light: {background: '#F8F4E3', text: '#545464', uiChrome: '#EDE6CE', swatch: '#F8F4E3', highlight: '#E5D9B6'},
  },
  {
    id: 'horizon',
    label: 'Horizon',
    dark: {background: '#1C1E26', text: '#E0E0E0', uiChrome: '#232530', swatch: '#1C1E26', highlight: '#2E303E'},
    light: {background: '#FDF0ED', text: '#1C1E26', uiChrome: '#FBE3DD', swatch: '#FDF0ED', highlight: '#F5CCC2'},
  },
  {
    id: 'synthwave84',
    label: 'Synthwave \'84',
    dark: {background: '#2A2139', text: '#F8F8F2', uiChrome: '#34294F', swatch: '#2A2139', highlight: '#463465'},
    light: {background: '#FBEAFF', text: '#2A2139', uiChrome: '#F3D9F7', swatch: '#FBEAFF', highlight: '#E3BEEF'},
  },
  {
    id: 'zenburn',
    label: 'Zenburn',
    dark: {background: '#3F3F3F', text: '#DCDCCC', uiChrome: '#4F4F4F', swatch: '#3F3F3F', highlight: '#5F5F5F'},
    light: {background: '#F0F0E0', text: '#3F3F3F', uiChrome: '#E0E0D0', swatch: '#F0F0E0', highlight: '#D0D0B8'},
  },
  {
    id: 'oceanic-next',
    label: 'Oceanic Next',
    dark: {background: '#1B2B34', text: '#C0C5CE', uiChrome: '#243B45', swatch: '#1B2B34', highlight: '#29404B'},
    light: {background: '#FAFAFA', text: '#343D46', uiChrome: '#E5E9EC', swatch: '#FAFAFA', highlight: '#C5D6DD'},
  },
  {
    id: 'palenight',
    label: 'Palenight',
    dark: {background: '#292D3E', text: '#A6ACCD', uiChrome: '#32374A', swatch: '#292D3E', highlight: '#3A3F58'},
    light: {background: '#FAFAFA', text: '#444267', uiChrome: '#E9E9F2', swatch: '#FAFAFA', highlight: '#D3D3E6'},
  },
  {
    id: 'spacegray',
    label: 'Spacegray',
    dark: {background: '#202328', text: '#B3B8C3', uiChrome: '#2A2E35', swatch: '#202328', highlight: '#34383F'},
    light: {background: '#F5F5F5', text: '#545863', uiChrome: '#E8E8E8', swatch: '#F5F5F5', highlight: '#D6D8DC'},
  },
]

export const DEFAULT_EPUB_THEME_ID: EpubThemeId = 'nord'

export function getEpubTheme(id: EpubThemeId): EpubTheme {
  return EPUB_THEMES.find(t => t.id === id) ?? EPUB_THEMES[0]
}
