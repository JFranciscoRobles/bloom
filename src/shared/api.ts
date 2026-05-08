import type {
  Account,
  Board,
  Card,
  CardWithTags,
  Category,
  Column,
  ExchangeRate,
  GanttCard,
  MonthlySummary,
  Tag,
  Transaction,
  TxType
} from './types'

export interface DashboardAPI {
  boards: {
    list: () => Promise<Board[]>
    create: (name: string, theme?: string) => Promise<Board>
    update: (id: number, patch: Partial<Pick<Board, 'name' | 'theme'>>) => Promise<void>
    rename: (id: number, name: string) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  columns: {
    listByBoard: (boardId: number) => Promise<Column[]>
    create: (boardId: number, name: string) => Promise<Column>
    rename: (id: number, name: string) => Promise<void>
    remove: (id: number) => Promise<void>
    reorder: (boardId: number, orderedIds: number[]) => Promise<void>
  }
  cards: {
    listByColumn: (columnId: number) => Promise<CardWithTags[]>
    create: (columnId: number, title: string) => Promise<Card>
    update: (
      id: number,
      patch: Partial<
        Pick<Card, 'title' | 'description' | 'start_date' | 'due_date' | 'progress' | 'depends_on'>
      >
    ) => Promise<void>
    remove: (id: number) => Promise<void>
    move: (cardId: number, toColumnId: number, orderedIds: number[]) => Promise<void>
    setTags: (cardId: number, tagIds: number[]) => Promise<void>
    listForBoard: (boardId: number) => Promise<GanttCard[]>
    listSiblings: (cardId: number) => Promise<GanttCard[]>
  }
  tags: {
    list: () => Promise<Tag[]>
    create: (name: string, color: string) => Promise<Tag>
    update: (id: number, patch: Partial<Pick<Tag, 'name' | 'color'>>) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  accounts: {
    list: () => Promise<Account[]>
    create: (name: string, currency: string, initialBalance: number) => Promise<Account>
    update: (id: number, patch: Partial<Pick<Account, 'name' | 'currency' | 'initial_balance'>>) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  categories: {
    list: () => Promise<Category[]>
    create: (name: string, type: TxType, color: string) => Promise<Category>
    update: (id: number, patch: Partial<Pick<Category, 'name' | 'color'>>) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  transactions: {
    list: (filters?: { from?: string; to?: string; accountId?: number }) => Promise<Transaction[]>
    create: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
    update: (id: number, patch: Partial<Omit<Transaction, 'id' | 'created_at'>>) => Promise<void>
    remove: (id: number) => Promise<void>
    monthlySummary: (year: number) => Promise<MonthlySummary[]>
  }
  rates: {
    list: () => Promise<ExchangeRate[]>
    upsert: (rate: ExchangeRate) => Promise<void>
    remove: (from: string, to: string) => Promise<void>
  }
  exports: {
    backupDb: () => Promise<{ ok: boolean; path?: string; error?: string }>
    excel: () => Promise<{ ok: boolean; path?: string; error?: string }>
  }
  imports: {
    db: () => Promise<{ ok: boolean; path?: string; error?: string }>
    excel: () => Promise<{ ok: boolean; path?: string; error?: string }>
  }
}
