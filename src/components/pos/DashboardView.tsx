'use client'

import { useState, useEffect, useMemo } from 'react'
import { DollarSign, CheckCircle, PiggyBank, AlertTriangle, TrendingUp, Calendar, CalendarDays, BarChart3, Eye, X, XCircle, Truck, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDateDDMMYYYY } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ReceiptModal from '@/components/pos/ReceiptModal'
import ReportModal from '@/components/pos/ReportModal'
import RestockItemsModal from '@/components/pos/RestockItemsModal'
import TransferHistoryModal from '@/components/pos/TransferHistoryModal'
import InventoryHistoryModal from '@/components/pos/InventoryHistoryModal'
import { useTransactions, useProducts, useTransactionItems, useStores, useInventory, useTransfers, useAdditions } from "@/hooks/useOfflineData"
import { useIsMobile } from '@/hooks/use-mobile'

interface DashboardStats {
  totalSales: number
  dailySales: number
  weeklySales: number
  monthlySales: number
  transactions: number
  netProfit: number
  lowStockCount: number
  outOfStockCount: number
  shopSummary: Array<{
    storeId: string
    totalSales: number
    transactionCount: number
  }>
}

interface Transaction {
  id: string
  transactionId: number
  date: string
  total: number
  subtotal: number
  tax: number
  items: any[]
  store: string
}

interface ShopGroup {
  store: string
  transactions: Transaction[]
  totalAmount: number
  transactionCount: number
  firstDate: string
  lastDate: string
}

export default function DashboardView() {
  const isMobile = useIsMobile()
  const localTransactions = useTransactions() || []
  
  // Deduplicate transactions by transactionId to avoid double-counting
  const uniqueTransactions = useMemo(() => {
    const seen = new Set()
    return localTransactions.filter(tx => {
      // If transactionId is missing, we still want to see it (might be a legacy entry or sync issue)
      if (tx.transactionId === undefined || tx.transactionId === null) return true
      
      if (seen.has(tx.transactionId)) return false
      seen.add(tx.transactionId)
      return true
    })
  }, [localTransactions])

  const allProducts = useProducts() || []
  const allTransactionItems = useTransactionItems() || []
  const allStores = useStores() || []
  const allInventory = useInventory() || []
  const transfers = useTransfers() || []
  const inventoryAdditions = useAdditions() || []
  
  const [showReports, setShowReports] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [showTransferHistory, setShowTransferHistory] = useState(false)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)
  const [transferIdToExpand, setTransferIdToExpand] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedShopTransactions, setSelectedShopTransactions] = useState<Transaction[] | null>(null)
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Calculate stats locally
  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    
    const dailySales = uniqueTransactions
      .filter(tx => new Date(tx.createdAt).getTime() >= today)
      .reduce((sum, tx) => sum + tx.total, 0)
      
    const totalSales = uniqueTransactions.reduce((sum, tx) => sum + tx.total, 0)
    
    // Improved counting: Count products that are low or out of stock in EACH shop
    let outOfStockCount = 0
    let lowStockCount = 0

    // Only consider physical shop locations for this count
    const shopStores = allStores.filter(s => s.name !== 'Warehouse')

    allProducts.forEach(product => {
      shopStores.forEach(store => {
        const inv = allInventory.find(i => i.productId === product.id && i.storeId === store.id)
        const stock = inv ? inv.stock : 0
        
        if (stock === 0) {
          outOfStockCount++
        } else if (stock < 11) {
          lowStockCount++
        }
      })
    })

    // Calculate actual net profit from transaction items
    // Only for unique transactions to avoid duplicates
    const uniqueTxIds = new Set(uniqueTransactions.map(t => t.id))
    const netProfit = allTransactionItems
      .filter(item => uniqueTxIds.has(item.transactionId))
      .reduce((sum, item) => {
        return sum + ((item.itemPrice - item.itemCost) * item.qty)
      }, 0)

    return {
      totalSales,
      dailySales,
      weeklySales: 0, 
      monthlySales: 0, 
      transactions: uniqueTransactions.length,
      netProfit,
      lowStockCount,
      outOfStockCount,
      shopSummary: []
    }
  }, [uniqueTransactions, allProducts, allTransactionItems, allInventory, allStores])

  const shopGroups = useMemo(() => {
    // Group transactions by store
    const groups: { [key: string]: any[] } = {}
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))
    
    uniqueTransactions.forEach(tx => {
      const storeName = storeMap.get(tx.storeId) || tx.storeId || 'Unknown Shop'
      if (!groups[storeName]) {
        groups[storeName] = []
      }
      groups[storeName].push(tx)
    })
    
    return Object.entries(groups).map(([store, txs]) => {
      const sorted = [...txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const totalAmount = txs.reduce((sum, tx) => sum + tx.total, 0)
      
      return {
        store,
        transactions: sorted.map(t => ({ 
          ...t, 
          date: t.createdAt.toISOString(), 
          store: storeMap.get(t.storeId) || t.storeId || 'Unknown Shop',
          items: allTransactionItems.filter(item => item.transactionId === t.id)
        })),
        totalAmount,
        transactionCount: txs.length,
        firstDate: sorted[sorted.length - 1]?.createdAt.toISOString() || '',
        lastDate: sorted[0]?.createdAt.toISOString() || ''
      }
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
  }, [uniqueTransactions, allStores, allTransactionItems])

  const todayTransactions = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))

    return uniqueTransactions
      .filter(tx => new Date(tx.createdAt).getTime() >= today)
      .map(tx => ({
        ...tx,
        date: tx.createdAt.toISOString(),
        store: storeMap.get(tx.storeId) || tx.storeId || 'Unknown Shop',
        items: allTransactionItems.filter(item => item.transactionId === tx.id)
      })) as unknown as Transaction[]
  }, [uniqueTransactions, allStores, allTransactionItems])

  const transactionsWithStoreNames = useMemo(() => {
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))
    return uniqueTransactions.map(tx => ({
      ...tx,
      date: tx.createdAt.toISOString(),
      store: storeMap.get(tx.storeId) || tx.storeId || 'Unknown Shop',
      items: allTransactionItems.filter(item => item.transactionId === tx.id)
    })) as unknown as Transaction[]
  }, [uniqueTransactions, allStores, allTransactionItems])

  const bestSeller = useMemo(() => {
    if (allTransactionItems.length === 0) return null
    
    const salesMap: { [key: string]: { name: string, qty: number } } = {}
    
    allTransactionItems.forEach(item => {
      if (!salesMap[item.productId]) {
        salesMap[item.productId] = { name: item.itemName, qty: 0 }
      }
      salesMap[item.productId].qty += item.qty
    })
    
    let best: { name: string, qty: number } | null = null
    let maxQty = -1
    
    for (const productId in salesMap) {
      if (salesMap[productId].qty > maxQty) {
        maxQty = salesMap[productId].qty
        best = salesMap[productId]
      }
    }
    
    return best
  }, [allTransactionItems])


  const formatCurrency = (amount: number) => {
    const safeAmount = typeof amount === 'number' ? amount : 0
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(safeAmount)
  }

  const StatCard = ({ title, value, trend, icon: Icon, color, bgColor, onClick }: any) => (
    <Card 
      className={cn(
        "transition-all border shadow-sm",
        bgColor || "bg-white",
        onClick && "cursor-pointer hover:border-emerald-500 hover:shadow-md active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{title}</p>
          {Icon && (
            <div className={cn("p-2 rounded-lg", color.replace('text-', 'bg-').replace('-600', '-50'))}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <p className={cn(
            "font-bold", 
            color || "text-slate-900",
            typeof value === 'string' && value.length > 15 ? "text-lg" : "text-2xl"
          )}>
            {value}
          </p>
          {trend && (
            <div className={cn("flex items-center gap-1 text-[10px]", color)}>
              {trend}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>
  }

  return (
    <div className="pt-0 px-2 md:px-4 pb-8 h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowReports(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="md:inline">Analytics</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowRestockModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span className="md:inline">Restock</span>
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
        <StatCard
          title="Total Transactions"
          value={stats.transactions.toString()}
          trend={
            <>
              <CheckCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Sales count</span>
            </>
          }
          icon={CheckCircle}
          color="text-emerald-600"
          bgColor="bg-white"
          onClick={() => setShowReports(true)}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalSales)}
          trend={
            <>
              <BarChart3 className="w-3 h-3" />
              <span className="hidden sm:inline">Performance</span>
            </>
          }
          icon={DollarSign}
          color="text-blue-600"
          bgColor="bg-white"
          onClick={() => setShowReports(true)}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(stats.netProfit)}
          trend={
            <>
              <PiggyBank className="w-3 h-3" />
              <span className="hidden sm:inline">After costs</span>
            </>
          }
          icon={PiggyBank}
          color="text-emerald-600"
          bgColor="bg-white"
        />
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.dailySales)}
          trend={
            <>
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">All shop sales</span>
            </>
          }
          icon={Calendar}
          color="text-indigo-600"
          bgColor="bg-white"
          onClick={() => {
            setSelectedStoreName('All Shops')
            setSelectedShopTransactions(todayTransactions)
          }}
        />
        <StatCard
          title="LOW/ OUT"
          value={
            <span className="flex items-center gap-1 md:gap-2">
              <span className="text-amber-600">{stats.lowStockCount}</span>
              <span className="text-slate-300 font-normal">/</span>
              <span className="text-red-600">{stats.outOfStockCount}</span>
            </span>
          }
          trend={
            <>
              <AlertTriangle className="w-3 h-3" />
              <span className="hidden sm:inline">Restock</span>
            </>
          }
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-white"
          onClick={() => setShowRestockModal(true)}
        />
        <StatCard
          title="Best Seller"
          value={bestSeller ? bestSeller.name : 'N/A'}
          trend={
            <>
              <TrendingUp className="w-3 h-3" />
              <span className="hidden sm:inline">{bestSeller ? `${bestSeller.qty} sold` : 'No sales'}</span>
            </>
          }
          icon={TrendingUp}
          color="text-emerald-600"
          bgColor="bg-white"
        />
      </div>

      {/* Recent Transactions */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Shop Transactions Summary</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowReports(true)}
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Analytics
        </Button>
      </div>
      <Card className="overflow-hidden border-none md:border shadow-none md:shadow-sm">
        {isMobile ? (
          <div className="space-y-3">
            {shopGroups.length === 0 ? (
              <div className="text-center text-slate-500 py-8 bg-white border rounded-xl">No transactions yet</div>
            ) : (
              shopGroups.slice(0, 10).map((shop, index) => (
                <Card key={index} className="p-4 border shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800">{shop.store}</h4>
                      <p className="text-[10px] text-slate-500 uppercase mt-1">
                        {shop.firstDate ? formatDateDDMMYYYY(shop.firstDate) : 'N/A'} - {shop.lastDate ? formatDateDDMMYYYY(shop.lastDate) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(shop.totalAmount)}</p>
                      <Badge variant="outline" className="mt-2 text-[9px] font-black uppercase bg-slate-50">
                        {shop.transactionCount} TX
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full mt-2 h-9 font-bold"
                    onClick={() => {
                      setSelectedStoreName(shop.store)
                      setSelectedShopTransactions(shop.transactions)
                    }}
                  >
                    View Details
                  </Button>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[600px] md:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                      No transactions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  shopGroups.slice(0, 10).map((shop, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium whitespace-nowrap">{shop.store}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {shop.firstDate ? formatDateDDMMYYYY(shop.firstDate) : 'N/A'} - {shop.lastDate ? formatDateDDMMYYYY(shop.lastDate) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 whitespace-nowrap">
                          {shop.transactionCount} tx{shop.transactionCount !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(shop.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setSelectedStoreName(shop.store)
                            setSelectedShopTransactions(shop.transactions)
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      
      {/* Detailed Recent Transactions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Detailed Recent Transactions</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowReports(true)}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            Full History
          </Button>
        </div>
        <Card className="overflow-hidden border-none md:border shadow-none md:shadow-sm">
          {isMobile ? (
            <div className="space-y-3">
              {transactionsWithStoreNames.length === 0 ? (
                <div className="text-center text-slate-500 py-8 bg-white border rounded-xl">No transactions found</div>
              ) : (
                transactionsWithStoreNames.slice(0, 10).map((tx) => (
                  <Card key={tx.id} className="p-4 border shadow-sm" onClick={() => setSelectedTransaction(tx)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-400">#{tx.transactionId}</span>
                          <span className="text-[10px] text-slate-500">{formatDateDDMMYYYY(tx.date)}</span>
                        </div>
                        <h4 className="font-bold text-slate-800">{tx.store}</h4>
                        <Badge variant="secondary" className="mt-2 text-[9px] bg-slate-50 text-slate-600 border-none">
                          {tx.items?.length || 0} ITEM{(tx.items?.length || 0) !== 1 ? 'S' : ''}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(tx.total)}</p>
                        <Button variant="ghost" size="sm" className="mt-2 h-8 text-[10px] uppercase font-bold text-slate-400">
                          Receipt
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsWithStoreNames.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        No individual transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactionsWithStoreNames.slice(0, 10).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium whitespace-nowrap text-xs">#{tx.transactionId}</TableCell>
                        <TableCell className="whitespace-nowrap">{tx.store}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateDDMMYYYY(tx.date)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="secondary" className="bg-slate-50 text-slate-600 border-none font-normal">
                            {tx.items?.length || 0} { (tx.items?.length || 0) === 1 ? 'item' : 'items' }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 whitespace-nowrap">
                          {formatCurrency(tx.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Stock Transfers */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Stock Transfers</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 hidden sm:flex">
              Last {Math.min(transfers.length, 5)} transfers
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowTransferHistory(true)}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              View All
            </Button>
          </div>
        </div>
        <Card className="overflow-hidden border-none md:border shadow-none md:shadow-sm">
          {isMobile ? (
            <div className="space-y-3">
              {transfers.length === 0 ? (
                <div className="text-center text-slate-500 py-8 bg-white border rounded-xl">No transfers yet</div>
              ) : (
                transfers.slice(0, 5).map((transfer) => (
                  <Card key={transfer.id} className="p-4 border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-400">#TR-{transfer.transferId}</span>
                          <span className="text-[10px] text-slate-500">{formatDateDDMMYYYY(transfer.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-slate-800">{transfer.toStore}</h4>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black uppercase">
                        {transfer.status}
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 font-bold text-emerald-600 border-emerald-100"
                      onClick={() => {
                        setTransferIdToExpand(transfer.id)
                        setShowTransferHistory(true)
                      }}
                    >
                      {transfer.items.length} {transfer.items.length === 1 ? 'Item' : 'Items'} - View Details
                    </Button>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        No transfers yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    transfers.slice(0, 5).map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium whitespace-nowrap">#TR-{transfer.transferId}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateDDMMYYYY(transfer.createdAt)}</TableCell>
                        <TableCell>
                          <span className="font-medium whitespace-nowrap">{transfer.toStore}</span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              setTransferIdToExpand(transfer.id)
                              setShowTransferHistory(true)
                            }}
                          >
                            {transfer.items.length} {transfer.items.length === 1 ? 'item' : 'items'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] whitespace-nowrap">
                            {transfer.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Inventory History */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Inventory Additions</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 hidden sm:flex">
              Last {Math.min(inventoryAdditions.length, 5)} additions
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowInventoryHistory(true)}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              View All
            </Button>
          </div>
        </div>
        <Card className="overflow-hidden border-none md:border shadow-none md:shadow-sm">
          {isMobile ? (
            <div className="space-y-3">
              {inventoryAdditions.length === 0 ? (
                <div className="text-center text-slate-500 py-8 bg-white border rounded-xl">No inventory additions yet</div>
              ) : (
                inventoryAdditions.slice(0, 5).map((addition) => (
                  <Card key={addition.id} className="p-4 border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-400">#INV-{addition.additionId}</span>
                          <span className="text-[10px] text-slate-500">{formatDateDDMMYYYY(addition.createdAt)}</span>
                        </div>
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(addition.totalCost)}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black uppercase">
                        Completed
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 font-bold text-emerald-600 border-emerald-100"
                      onClick={() => {
                        setSelectedInventoryId(addition.id)
                        setShowInventoryHistory(true)
                      }}
                    >
                      {addition.items.length} {addition.items.length === 1 ? 'Item' : 'Items'} - View Details
                    </Button>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryAdditions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        No inventory additions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventoryAdditions.slice(0, 5).map((addition) => (
                      <TableRow key={addition.id}>
                        <TableCell className="font-medium whitespace-nowrap">#INV-{addition.additionId}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateDDMMYYYY(addition.createdAt)}</TableCell>
                        <TableCell className="font-medium text-emerald-600 whitespace-nowrap">
                          {formatCurrency(addition.totalCost)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              setSelectedInventoryId(addition.id)
                              setShowInventoryHistory(true)
                            }}
                          >
                            {addition.items.length} {addition.items.length === 1 ? 'item' : 'items'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] whitespace-nowrap">
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {showReports && (
        <ReportModal
          isOpen={showReports}
          onClose={() => setShowReports(false)}
          transactions={transactionsWithStoreNames}
        />
      )}

      {selectedTransaction && (
        <ReceiptModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
        />
      )}

      {selectedShopTransactions && (
        <Dialog open={!!selectedShopTransactions} onOpenChange={() => setSelectedShopTransactions(null)}>
          <DialogContent className="max-w-2xl w-[95vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span className="truncate">Transactions {selectedStoreName ? `- ${selectedStoreName}` : ''}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <Table className="min-w-[500px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedShopTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">#{tx.transactionId}</TableCell>
                      <TableCell className="text-[10px] md:text-xs whitespace-nowrap">{formatDateDDMMYYYY(tx.date)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{tx.items?.length || 0} item{(tx.items?.length || 0) !== 1 ? 's' : ''}</TableCell>
                      <TableCell className="text-right font-bold text-xs whitespace-nowrap">{formatCurrency(tx.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setSelectedTransaction(tx)}
                        >
                          Receipt
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex-shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs text-slate-600 text-center sm:text-left">
                  <span className="font-medium">{selectedShopTransactions.length}</span> tx | 
                  <span className="font-medium ml-2">Total: {formatCurrency(selectedShopTransactions.reduce((sum, tx) => sum + tx.total, 0))}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setSelectedShopTransactions(null)}>
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showRestockModal && (
        <RestockItemsModal
          isOpen={showRestockModal}
          onClose={() => setShowRestockModal(false)}
          onRestockComplete={() => {
            // Refresh dashboard stats after restock
            // Data will refresh automatically due to useLiveQuery hooks
          }}
        />
      )}

      {showTransferHistory && (
        <TransferHistoryModal
          isOpen={showTransferHistory}
          onClose={() => {
            setShowTransferHistory(false)
            setTransferIdToExpand(null)
          }}
          expandTransferId={transferIdToExpand}
        />
      )}

      {showInventoryHistory && (
        <InventoryHistoryModal
          isOpen={showInventoryHistory}
          onClose={() => {
            setShowInventoryHistory(false)
            setSelectedInventoryId(null)
          }}
          initialExpandedId={selectedInventoryId}
        />
      )}
    </div>
  )
}
