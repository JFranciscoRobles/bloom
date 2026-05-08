import { ipcMain } from 'electron'
import {
  accountsRepo,
  boardsRepo,
  cardsRepo,
  categoriesRepo,
  columnsRepo,
  ratesRepo,
  tagsRepo,
  transactionsRepo
} from './db/repos'
import { backupDb, exportExcel, importDb, importExcel } from './exports'

export function registerIpcHandlers(): void {
  ipcMain.handle('boards:list', () => boardsRepo.list())
  ipcMain.handle('boards:create', (_, name: string, theme?: string) =>
    boardsRepo.create(name, theme)
  )
  ipcMain.handle('boards:update', (_, id: number, patch) => boardsRepo.update(id, patch))
  ipcMain.handle('boards:rename', (_, id: number, name: string) => boardsRepo.rename(id, name))
  ipcMain.handle('boards:remove', (_, id: number) => boardsRepo.remove(id))

  ipcMain.handle('columns:listByBoard', (_, boardId: number) => columnsRepo.listByBoard(boardId))
  ipcMain.handle('columns:create', (_, boardId: number, name: string) => columnsRepo.create(boardId, name))
  ipcMain.handle('columns:rename', (_, id: number, name: string) => columnsRepo.rename(id, name))
  ipcMain.handle('columns:remove', (_, id: number) => columnsRepo.remove(id))
  ipcMain.handle('columns:reorder', (_, boardId: number, ids: number[]) =>
    columnsRepo.reorder(boardId, ids)
  )

  ipcMain.handle('cards:listByColumn', (_, columnId: number) => cardsRepo.listByColumn(columnId))
  ipcMain.handle('cards:create', (_, columnId: number, title: string) =>
    cardsRepo.create(columnId, title)
  )
  ipcMain.handle('cards:update', (_, id: number, patch) => cardsRepo.update(id, patch))
  ipcMain.handle('cards:remove', (_, id: number) => cardsRepo.remove(id))
  ipcMain.handle('cards:move', (_, cardId: number, toColumnId: number, ids: number[]) =>
    cardsRepo.move(cardId, toColumnId, ids)
  )
  ipcMain.handle('cards:setTags', (_, cardId: number, tagIds: number[]) =>
    cardsRepo.setTags(cardId, tagIds)
  )
  ipcMain.handle('cards:listForBoard', (_, boardId: number) => cardsRepo.listForBoard(boardId))
  ipcMain.handle('cards:listSiblings', (_, cardId: number) => cardsRepo.listSiblings(cardId))

  ipcMain.handle('tags:list', () => tagsRepo.list())
  ipcMain.handle('tags:create', (_, name: string, color: string) => tagsRepo.create(name, color))
  ipcMain.handle('tags:update', (_, id: number, patch) => tagsRepo.update(id, patch))
  ipcMain.handle('tags:remove', (_, id: number) => tagsRepo.remove(id))

  ipcMain.handle('accounts:list', () => accountsRepo.list())
  ipcMain.handle('accounts:create', (_, name: string, currency: string, ib: number) =>
    accountsRepo.create(name, currency, ib)
  )
  ipcMain.handle('accounts:update', (_, id: number, patch) => accountsRepo.update(id, patch))
  ipcMain.handle('accounts:remove', (_, id: number) => accountsRepo.remove(id))

  ipcMain.handle('categories:list', () => categoriesRepo.list())
  ipcMain.handle('categories:create', (_, name: string, type, color: string) =>
    categoriesRepo.create(name, type, color)
  )
  ipcMain.handle('categories:update', (_, id: number, patch) => categoriesRepo.update(id, patch))
  ipcMain.handle('categories:remove', (_, id: number) => categoriesRepo.remove(id))

  ipcMain.handle('transactions:list', (_, filters) => transactionsRepo.list(filters))
  ipcMain.handle('transactions:create', (_, tx) => transactionsRepo.create(tx))
  ipcMain.handle('transactions:update', (_, id: number, patch) => transactionsRepo.update(id, patch))
  ipcMain.handle('transactions:remove', (_, id: number) => transactionsRepo.remove(id))
  ipcMain.handle('transactions:monthlySummary', (_, year: number) =>
    transactionsRepo.monthlySummary(year)
  )

  ipcMain.handle('rates:list', () => ratesRepo.list())
  ipcMain.handle('rates:upsert', (_, rate) => ratesRepo.upsert(rate))
  ipcMain.handle('rates:remove', (_, from: string, to: string) => ratesRepo.remove(from, to))

  ipcMain.handle('exports:backupDb', () => backupDb())
  ipcMain.handle('exports:excel', () => exportExcel())
  ipcMain.handle('imports:db', () => importDb())
  ipcMain.handle('imports:excel', () => importExcel())
}
