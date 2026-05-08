import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardAPI } from '../shared/api'

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: DashboardAPI = {
  boards: {
    list: () => invoke('boards:list'),
    create: (name, theme) => invoke('boards:create', name, theme),
    update: (id, patch) => invoke('boards:update', id, patch),
    rename: (id, name) => invoke('boards:rename', id, name),
    remove: (id) => invoke('boards:remove', id)
  },
  columns: {
    listByBoard: (boardId) => invoke('columns:listByBoard', boardId),
    create: (boardId, name) => invoke('columns:create', boardId, name),
    rename: (id, name) => invoke('columns:rename', id, name),
    remove: (id) => invoke('columns:remove', id),
    reorder: (boardId, ids) => invoke('columns:reorder', boardId, ids)
  },
  cards: {
    listByColumn: (columnId) => invoke('cards:listByColumn', columnId),
    create: (columnId, title) => invoke('cards:create', columnId, title),
    update: (id, patch) => invoke('cards:update', id, patch),
    remove: (id) => invoke('cards:remove', id),
    move: (cardId, toColumnId, ids) => invoke('cards:move', cardId, toColumnId, ids),
    setTags: (cardId, tagIds) => invoke('cards:setTags', cardId, tagIds),
    listForBoard: (boardId) => invoke('cards:listForBoard', boardId),
    listSiblings: (cardId) => invoke('cards:listSiblings', cardId)
  },
  tags: {
    list: () => invoke('tags:list'),
    create: (name, color) => invoke('tags:create', name, color),
    update: (id, patch) => invoke('tags:update', id, patch),
    remove: (id) => invoke('tags:remove', id)
  },
  accounts: {
    list: () => invoke('accounts:list'),
    create: (name, currency, ib) => invoke('accounts:create', name, currency, ib),
    update: (id, patch) => invoke('accounts:update', id, patch),
    remove: (id) => invoke('accounts:remove', id)
  },
  categories: {
    list: () => invoke('categories:list'),
    create: (name, type, color) => invoke('categories:create', name, type, color),
    update: (id, patch) => invoke('categories:update', id, patch),
    remove: (id) => invoke('categories:remove', id)
  },
  transactions: {
    list: (filters) => invoke('transactions:list', filters),
    create: (tx) => invoke('transactions:create', tx),
    update: (id, patch) => invoke('transactions:update', id, patch),
    remove: (id) => invoke('transactions:remove', id),
    monthlySummary: (year) => invoke('transactions:monthlySummary', year)
  },
  rates: {
    list: () => invoke('rates:list'),
    upsert: (rate) => invoke('rates:upsert', rate),
    remove: (from, to) => invoke('rates:remove', from, to)
  },
  exports: {
    backupDb: () => invoke('exports:backupDb'),
    excel: () => invoke('exports:excel')
  },
  imports: {
    db: () => invoke('imports:db'),
    excel: () => invoke('imports:excel')
  }
}

contextBridge.exposeInMainWorld('api', api)
