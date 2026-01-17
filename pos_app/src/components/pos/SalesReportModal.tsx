'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { X, TrendingUp, Calendar, CalendarDays, Store, Package, ArrowUpRight, ArrowDownRight, Search, Receipt } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateDDMMYYYY } from '@/lib/utils'

interface TransactionItem {
  productId: string
  itemName: string
  itemPrice: number
  qty: number
}

interface Transaction {
  id: number
  date: string
  total: number
  store: string
  subtotal: number
  tax: number
  items: TransactionItem[]
}

interface SalesReportModalProps {
  isOpen: boolean
  onClose: () => void
  transactions: Transaction[]
  initialDateRange?: string
  embedded?: boolean
}

export default function SalesReportModal({ 
  isOpen, 
  onClose, 
  transactions, 
  initialDateRange = 'all',
  embedded = false
}: SalesReportModalProps) {
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [itemSearch, setItemSearch] = useState<string>('')
  const [dateRange, setDateRange] = useState<string>(initialDateRange)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const stores = useMemo(() => {
    const uniqueStores = new Set(transactions.map(tx => tx.store))
    return Array.from(uniqueStores)
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesStore = storeFilter === 'all' || tx.store === storeFilter
      
      const now = new Date()
      const txDate = new Date(tx.date)
      let matchesDate = true

      if (dateRange === 'daily') {
        matchesDate = txDate.toDateString() === now.toDateString()
      } else if (dateRange === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        matchesDate = txDate >= weekAgo
      } else if (dateRange === 'monthly') {
        matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      }

      const matchesItem = itemSearch === '' || tx.items.some(item => 
        item.itemName.toLowerCase().includes(itemSearch.toLowerCase())
      )

      return matchesStore && matchesDate && matchesItem
    })
  }, [transactions, storeFilter, dateRange, itemSearch])

  const itemStats = useMemo(() => {
    const stats: Record<string, { name: string, qty: number, revenue: number }> = {}
    
    filteredTransactions.forEach(tx => {
      tx.items.forEach(item => {
        if (!stats[item.productId]) {
          stats[item.productId] = { name: item.itemName, qty: 0, revenue: 0 }
        }
        stats[item.productId].qty += item.qty
        stats[item.productId].revenue += item.itemPrice * item.qty
      })
    })

    const sortedItems = Object.values(stats).sort((a, b) => b.qty - a.qty)
    return {
      bestSelling: sortedItems.slice(0, 5),
      worstSelling: sortedItems.length > 5 ? sortedItems.slice(-5).reverse() : []
    }
  }, [filteredTransactions])

  const summary = useMemo(() => {
    const total = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0)
    const count = filteredTransactions.length
    const avg = count > 0 ? total / count : 0
    return { total, count, avg }
  }, [filteredTransactions])

  const ReportCard = ({ label, value, icon: Icon, color = 'emerald' }: any) => (
    <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'}`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black mt-1 text-slate-900">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'} group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )

  const content = (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time Period</label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Today's Sales</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="all">All Time Records</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Store Location</label>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Global (All Stores)</SelectItem>
              {stores.map(store => (
                <SelectItem key={store} value={store}>{store}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Inventory</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Find items in transactions..." 
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="pl-10 bg-slate-50 border-slate-200 h-11"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <ReportCard 
          label="Total Revenue"
          value={formatCurrency(summary.total)} 
          icon={TrendingUp} 
        />
        <ReportCard 
          label="Transaction Volume"
          value={summary.count} 
          icon={Receipt} 
          color="blue"
        />
        <ReportCard 
          label="Avg. Transaction"
          value={formatCurrency(summary.avg)} 
          icon={Package} 
          color="purple"
        />
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="items">Product Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="border border-slate-100 shadow-none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        No transactions match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium text-emerald-600">#{tx.id}</TableCell>
                        <TableCell className="text-slate-600">{formatDateDDMMYYYY(tx.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm">{tx.store}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                            {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(tx.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Best Selling */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-semibold text-emerald-700">
                <ArrowUpRight className="w-5 h-5" />
                Best Selling Items
              </h4>
              <div className="space-y-3">
                {itemStats.bestSelling.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-emerald-600 font-medium">{item.qty} units sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
                {itemStats.bestSelling.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4 italic">No sales data available</p>
                )}
              </div>
            </div>

            {/* Worst Selling */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-semibold text-red-700">
                <ArrowDownRight className="w-5 h-5" />
                Lowest Selling Items
              </h4>
              <div className="space-y-3">
                {itemStats.worstSelling.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-red-600 font-medium">{item.qty} units sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
                {itemStats.worstSelling.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4 italic">No sales data available</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  if (embedded) return content

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Detailed Sales Report
          </DialogTitle>
        </DialogHeader>
        {content}
        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button variant="outline" className="px-8" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

