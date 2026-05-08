export interface BoardTheme {
  id: string
  name: string
  /** Background gradient stops, applied to body */
  gradient: [string, string, string]
  /** Primary accent color: buttons, focus rings, active board */
  accent: string
  /** Hover variant of accent */
  accentHover: string
  /** Soft tint for borders / subtle backgrounds */
  soft: string
  /** Text color on top of accent */
  onAccent: string
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'rose',
    name: 'Rosa',
    gradient: ['#fce7f3', '#fbcfe8', '#f5d0fe'],
    accent: '#f9a8d4',
    accentHover: '#f472b6',
    soft: '#fce7f3',
    onAccent: '#3d2e5c'
  },
  {
    id: 'lavender',
    name: 'Lavanda',
    gradient: ['#faf5ff', '#e9d5ff', '#ddd6fe'],
    accent: '#c4b5fd',
    accentHover: '#a78bfa',
    soft: '#ede9fe',
    onAccent: '#3d2e5c'
  },
  {
    id: 'sky',
    name: 'Cielo',
    gradient: ['#eff6ff', '#dbeafe', '#bfdbfe'],
    accent: '#93c5fd',
    accentHover: '#60a5fa',
    soft: '#dbeafe',
    onAccent: '#1e3a8a'
  },
  {
    id: 'mint',
    name: 'Menta',
    gradient: ['#ecfdf5', '#d1fae5', '#bbf7d0'],
    accent: '#86efac',
    accentHover: '#4ade80',
    soft: '#d1fae5',
    onAccent: '#14532d'
  },
  {
    id: 'lemon',
    name: 'Limón',
    gradient: ['#fefce8', '#fef9c3', '#fef08a'],
    accent: '#fde68a',
    accentHover: '#fcd34d',
    soft: '#fef9c3',
    onAccent: '#713f12'
  },
  {
    id: 'peach',
    name: 'Durazno',
    gradient: ['#fff7ed', '#ffedd5', '#fed7aa'],
    accent: '#fcd5b5',
    accentHover: '#fdba74',
    soft: '#ffedd5',
    onAccent: '#7c2d12'
  },
  {
    id: 'coral',
    name: 'Coral',
    gradient: ['#fef2f2', '#fee2e2', '#fecaca'],
    accent: '#fca5a5',
    accentHover: '#f87171',
    soft: '#fee2e2',
    onAccent: '#7f1d1d'
  },
  {
    id: 'turquoise',
    name: 'Turquesa',
    gradient: ['#ecfeff', '#cffafe', '#a5f3fc'],
    accent: '#a5f3fc',
    accentHover: '#67e8f9',
    soft: '#cffafe',
    onAccent: '#155e75'
  },
  {
    id: 'lilac',
    name: 'Lila',
    gradient: ['#fdf4ff', '#fae8ff', '#f5d0fe'],
    accent: '#e9d5ff',
    accentHover: '#d8b4fe',
    soft: '#fae8ff',
    onAccent: '#581c87'
  },
  {
    id: 'cloud',
    name: 'Nube',
    gradient: ['#f8fafc', '#f1f5f9', '#e2e8f0'],
    accent: '#cbd5e1',
    accentHover: '#94a3b8',
    soft: '#e2e8f0',
    onAccent: '#1e293b'
  }
]

export const DEFAULT_THEME_ID = 'rose'

export function getTheme(id: string | null | undefined): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

export function applyTheme(theme: BoardTheme): void {
  const root = document.documentElement
  root.style.setProperty('--theme-grad-1', theme.gradient[0])
  root.style.setProperty('--theme-grad-2', theme.gradient[1])
  root.style.setProperty('--theme-grad-3', theme.gradient[2])
  root.style.setProperty('--theme-accent', theme.accent)
  root.style.setProperty('--theme-accent-hover', theme.accentHover)
  root.style.setProperty('--theme-soft', theme.soft)
  root.style.setProperty('--theme-on-accent', theme.onAccent)
  root.style.setProperty('--theme-accent-rgb', hexToRgb(theme.accent))
  root.style.setProperty('--theme-soft-rgb', hexToRgb(theme.soft))
}
