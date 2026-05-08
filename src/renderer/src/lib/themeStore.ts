import { create } from 'zustand'
import { applyTheme, DEFAULT_THEME_ID, getTheme } from './themes'

interface ThemeState {
  themeId: string
  setThemeId: (id: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: DEFAULT_THEME_ID,
  setThemeId: (id: string) => {
    applyTheme(getTheme(id))
    set({ themeId: id })
  }
}))
