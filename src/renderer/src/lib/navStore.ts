import { create } from 'zustand'

export type Tab = 'home' | 'kanban' | 'gantt' | 'finances'

interface NavState {
  tab: Tab
  activeBoardId: number | null
  setTab: (tab: Tab) => void
  openBoard: (boardId: number, tab?: 'kanban' | 'gantt') => void
  goHome: () => void
}

export const useNavStore = create<NavState>((set) => ({
  tab: 'home',
  activeBoardId: null,
  setTab: (tab) => set({ tab }),
  openBoard: (boardId, tab = 'kanban') => set({ activeBoardId: boardId, tab }),
  goHome: () => set({ tab: 'home' })
}))
