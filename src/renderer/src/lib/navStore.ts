import { create } from 'zustand'

export type Tab = 'home' | 'kanban' | 'gantt' | 'finances'

interface NavState {
  tab: Tab
  activeBoardId: number | null
  /** When set, KanbanPage should open the editor for this card and clear it. */
  pendingCardId: number | null
  /** When set, TransactionsView should highlight this row and clear it. */
  pendingTransactionId: number | null
  setTab: (tab: Tab) => void
  openBoard: (boardId: number, tab?: 'kanban' | 'gantt') => void
  openCard: (boardId: number, cardId: number) => void
  openTransaction: (txId: number) => void
  consumePendingCard: () => void
  consumePendingTransaction: () => void
  goHome: () => void
}

export const useNavStore = create<NavState>((set) => ({
  tab: 'home',
  activeBoardId: null,
  pendingCardId: null,
  pendingTransactionId: null,
  setTab: (tab) => set({ tab }),
  openBoard: (boardId, tab = 'kanban') => set({ activeBoardId: boardId, tab }),
  openCard: (boardId, cardId) =>
    set({ activeBoardId: boardId, tab: 'kanban', pendingCardId: cardId }),
  openTransaction: (txId) => set({ tab: 'finances', pendingTransactionId: txId }),
  consumePendingCard: () => set({ pendingCardId: null }),
  consumePendingTransaction: () => set({ pendingTransactionId: null }),
  goHome: () => set({ tab: 'home' })
}))
