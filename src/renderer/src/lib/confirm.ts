import { create } from 'zustand'

/**
 * Imperative confirm dialog. Use from anywhere:
 *
 *   if (await confirm('Borrar tarjeta?')) { ... }
 *
 * A single <ConfirmModalRoot /> mounted in App listens to this store.
 *
 * Replaces `window.confirm()` which has focus issues on Electron + Windows:
 * after the native dialog closes, focus sometimes fails to return to inputs.
 */
export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmState {
  current: (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  open: (opts: ConfirmOptions) => Promise<boolean>
  close: (result: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  open: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ current: { ...opts, resolve } })
    }),
  close: (result) => {
    const c = get().current
    if (c) c.resolve(result)
    set({ current: null })
  }
}))

/** Convenience: `if (await confirm('Borrar X?')) { ... }` */
export function confirm(
  messageOrOpts: string | ConfirmOptions,
  extra?: Partial<ConfirmOptions>
): Promise<boolean> {
  const opts: ConfirmOptions =
    typeof messageOrOpts === 'string'
      ? { message: messageOrOpts, destructive: true, ...extra }
      : { destructive: true, ...messageOrOpts, ...extra }
  return useConfirmStore.getState().open(opts)
}

/**
 * Single-button informational dialog. Replaces `window.alert()` (same focus
 * issue on Electron + Windows). Returns a promise so callers can `await`.
 */
export function notify(
  messageOrOpts: string | Omit<ConfirmOptions, 'cancelText' | 'destructive'>,
  extra?: Partial<ConfirmOptions>
): Promise<void> {
  const base: ConfirmOptions =
    typeof messageOrOpts === 'string'
      ? { message: messageOrOpts, title: 'Bloom', destructive: false, ...extra }
      : { destructive: false, ...messageOrOpts, ...extra }
  // The confirm modal renders a Cancel button when destructive=false too; hide
  // it by setting cancelText to null... we just call confirm and ignore result.
  return useConfirmStore
    .getState()
    .open({ ...base, cancelText: '', confirmText: base.confirmText ?? 'OK' })
    .then(() => undefined)
}
