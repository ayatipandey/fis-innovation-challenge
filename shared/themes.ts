import type { ThemeId } from './types.js';

export interface Theme {
  id: ThemeId;
  name: string;
  bg: string;
  text: string;
  /** Secondary text. */
  text2: string;
  button: string;
  onButton: string;
  orbs: [string, string];
}

/** Glass themes. Fresh Green is the default. */
export const THEMES: Theme[] = [
  { id: 'fresh-green', name: 'Fresh Green', bg: '#F6F4EC', text: '#012834', text2: '#2C7A24', button: '#4BCD3E', onButton: '#012834', orbs: ['#8FD9E8', '#98E08F'] },
  { id: 'ivory-silk', name: 'Ivory Silk', bg: '#F7F2E9', text: '#2B211B', text2: '#5C4F43', button: '#2F4A3B', onButton: '#F4F1E8', orbs: ['#EFCB8E', '#F2C9C0'] },
  { id: 'sage-mist', name: 'Sage Mist', bg: '#EEF0E8', text: '#24302A', text2: '#4A5A50', button: '#6B2433', onButton: '#FFFFFF', orbs: ['#A9C5B0', '#E4D9C6'] },
  { id: 'sandy-shore', name: 'Sandy Shore', bg: '#FAF3E3', text: '#0B2545', text2: '#3D5573', button: '#0E7490', onButton: '#FFFFFF', orbs: ['#7DD3FC', '#F5D9A8'] },
  { id: 'seafoam-sun', name: 'Seafoam and Sun', bg: '#E6F6F3', text: '#0B2545', text2: '#2F5560', button: '#FACC15', onButton: '#0B2545', orbs: ['#99E1D9', '#FDE68A'] },
];

export const DEFAULT_THEME: ThemeId = 'fresh-green';
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
