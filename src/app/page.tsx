'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Store as StoreIcon,
  ShoppingCart,
  Calculator,
  LogOut,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import AddProductModal from '@/components/pos/AddProductModal'
import RestockModal from '@/components/pos/RestockModal'
import DashboardView from '@/components/pos/DashboardView'
import WarehouseView from '@/components/pos/WarehouseView'
import StoreInventoryView from '@/components/pos/StoreInventoryView'
import POSTerminalView from '@/components/pos/POSTerminalView'
import AccountingView from '@/components/pos/AccountingView'

type ViewType = 'dashboard' | 'warehouse' | 'stores' | 'pos' | 'accounting'

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [currentStore, setCurrentStore] = useState<string>('Klagon Shop')

  const stores = [
    'Klagon Shop',
    'Teshie Shop',
    'Cape Coast Shop',
    'T-Kokompe Shop',
    'T-Central Shop',
    'Kumasi Shop',
    'Obuasi Shop',
    'Vehicle Sales Agent',
    'Online Shop'
  ]

  const navItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'warehouse' as ViewType, label: 'Warehouse Inv.', icon: Package },
    { id: 'stores' as ViewType, label: 'Store Inv.', icon: StoreIcon },
    { id: 'pos' as ViewType, label: 'POS Terminal', icon: ShoppingCart },
    { id: 'accounting' as ViewType, label: 'Accounting', icon: Calculator },
  ]

  const getPageTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Dashboard'
      case 'warehouse': return 'Warehouse Inventory'
      case 'stores': return 'Store Inventory'
      case 'pos': return 'POS Terminal'
      case 'accounting': return 'Accounting'
      default: return 'Dashboard'
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <nav className="w-64 bg-white border-r border-slate-200 flex flex-col z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-200">
          <span className="text-xl font-bold text-emerald-600">HENSCO LTD</span>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  activeView === item.id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-200">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all w-full">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-slate-900">{getPageTitle()}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Admin User</span>
            <Avatar>
              <AvatarFallback className="bg-emerald-600 text-white font-semibold">AU</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'warehouse' && (
            <WarehouseView 
              stores={stores} 
              currentStore={currentStore} 
              onStoreChange={setCurrentStore} 
            />
          )}
          {activeView === 'stores' && (
            <StoreInventoryView 
              stores={stores} 
              currentStore={currentStore} 
              onStoreChange={setCurrentStore} 
            />
          )}
          {activeView === 'pos' && (
            <POSTerminalView 
              stores={stores} 
              currentStore={currentStore} 
              onStoreChange={setCurrentStore} 
            />
          )}
          {activeView === 'accounting' && <AccountingView />}
        </div>
      </main>
    </div>
  )
}
