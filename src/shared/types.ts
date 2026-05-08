export interface Board {
  id: number
  name: string
  theme: string
  position: number
  created_at: string
}

export interface Column {
  id: number
  board_id: number
  name: string
  position: number
}

export interface Card {
  id: number
  column_id: number
  title: string
  description: string | null
  start_date: string | null
  due_date: string | null
  progress: number
  depends_on: number | null
  position: number
  created_at: string
}

export interface GanttCard extends Card {
  tags: Tag[]
  board_id: number
  board_name: string
  column_name: string
  column_position: number
}

export interface Tag {
  id: number
  name: string
  color: string
}

export interface CardWithTags extends Card {
  tags: Tag[]
}

export type TxType = 'income' | 'expense'

export interface Account {
  id: number
  name: string
  currency: string
  initial_balance: number
}

export interface Category {
  id: number
  name: string
  type: TxType
  color: string
}

export interface Transaction {
  id: number
  account_id: number
  category_id: number | null
  type: TxType
  amount: number
  currency: string
  date: string
  note: string | null
  created_at: string
}

export interface ExchangeRate {
  from_currency: string
  to_currency: string
  rate: number
  updated_at: string
}

export interface MonthlySummary {
  month: string
  currency: string
  income: number
  expense: number
}

export interface DueSoonCard {
  id: number
  title: string
  due_date: string
  progress: number
  board_id: number
  board_name: string
}

export type SearchResult =
  | {
      kind: 'card'
      id: number
      title: string
      snippet: string | null
      board_id: number
      board_name: string
      column_name: string
      tag_color: string | null
    }
  | {
      kind: 'board'
      id: number
      name: string
      theme: string
    }
  | {
      kind: 'transaction'
      id: number
      type: TxType
      amount: number
      currency: string
      date: string
      account_name: string
      category_name: string | null
      category_color: string | null
      note: string | null
    }
