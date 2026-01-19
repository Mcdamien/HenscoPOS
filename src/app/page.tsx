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
import { ALLOWED_SHOPS } from '@/lib/constants'
import AddProductModal from '@/components/pos/AddProductModal'
import DashboardView from '@/components/pos/DashboardView'
import WarehouseView from '@/components/pos/WarehouseView'
import StoreInventoryView from '@/components/pos/StoreInventoryView'
import POSTerminalView from '@/components/pos/POSTerminalView'
import AccountingView from '@/components/pos/AccountingView'

type ViewType = 'dashboard' | 'warehouse' | 'stores' | 'pos' | 'accounting'

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [currentStore, setCurrentStore] = useState<string>('Klagon Shop')

  const stores = [...ALLOWED_SHOPS]

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
    <div className="h-screen max-h-screen flex bg-slate-50 overflow-hidden fixed inset-0">
      {/* Sidebar */}
      <nav className="w-20 hover:w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 transition-all duration-300 ease-in-out group">
        <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center group-hover:gap-3 gap-0 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 shrink-0 ${
                  activeView === item.id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-200 shrink-0 overflow-hidden">
          <div className="mt-2 whitespace-nowrap">
            <p className="text-center text-sm text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              By McDamien Copyright © 2026
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between pl-8 pr-4 shrink-0 z-20 rounded-b-2xl shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Admin User</span>
            <Avatar>
              <AvatarFallback className="bg-emerald-600 text-white font-semibold">AU</AvatarFallback>
            </Avatar>
            <button 
              className="p-2 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
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
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <POSTerminalView 
                stores={stores} 
                currentStore={currentStore} 
                onStoreChange={setCurrentStore} 
              />
            </div>
          )}
          {activeView === 'accounting' && <AccountingView />}
        </div>
      </main>
    </div>
  )
}
