import { useEffect, useState } from 'react'
import { ListIcon, BarChart3Icon, WalletIcon, TagsIcon, ArrowLeftRightIcon } from 'lucide-react'
import TransactionsView from '../components/finances/TransactionsView'
import SummaryView from '../components/finances/SummaryView'
import AccountsView from '../components/finances/AccountsView'
import CategoriesView from '../components/finances/CategoriesView'
import RatesView from '../components/finances/RatesView'
import { useNavStore } from '../lib/navStore'

type SubTab = 'tx' | 'summary' | 'accounts' | 'categories' | 'rates'

export default function FinancesPage(): JSX.Element {
  const [tab, setTab] = useState<SubTab>('tx')
  const pendingTransactionId = useNavStore((s) => s.pendingTransactionId)

  // If a transaction was requested via the command palette, switch to the
  // Transactions subtab so it can be highlighted.
  useEffect(() => {
    if (pendingTransactionId != null) setTab('tx')
  }, [pendingTransactionId])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-pastel-purple/30 overflow-x-auto scrollbar-thin">
        <button onClick={() => setTab('tx')} className={`btn ${tab === 'tx' ? 'btn-primary' : ''}`}>
          <ListIcon size={14} /> Transacciones
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`btn ${tab === 'summary' ? 'btn-primary' : ''}`}
        >
          <BarChart3Icon size={14} /> Resumen
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`btn ${tab === 'accounts' ? 'btn-primary' : ''}`}
        >
          <WalletIcon size={14} /> Cuentas
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`btn ${tab === 'categories' ? 'btn-primary' : ''}`}
        >
          <TagsIcon size={14} /> Categorías
        </button>
        <button onClick={() => setTab('rates')} className={`btn ${tab === 'rates' ? 'btn-primary' : ''}`}>
          <ArrowLeftRightIcon size={14} /> Tasas
        </button>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        {tab === 'tx' && <TransactionsView />}
        {tab === 'summary' && <SummaryView />}
        {tab === 'accounts' && <AccountsView />}
        {tab === 'categories' && <CategoriesView />}
        {tab === 'rates' && <RatesView />}
      </div>
    </div>
  )
}
