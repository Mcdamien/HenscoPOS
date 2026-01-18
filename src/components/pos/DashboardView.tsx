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
import SalesAnalyticsModal from '@/components/pos/SalesAnalyticsModal'
import ReportModal from '@/components/pos/ReportModal'
import RestockItemsModal from '@/components/pos/RestockItemsModal'
import TransferHistoryModal from '@/components/pos/TransferHistoryModal'
import InventoryHistoryModal from '@/components/pos/InventoryHistoryModal'
import { useTransactions, useProducts, useTransactionItems, useStores, useInventory } from "@/hooks/useOfflineData"

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
  const localTransactions = useTransactions() || []
  const allProducts = useProducts() || []
  const allTransactionItems = useTransactionItems() || []
  const allStores = useStores() || []
  const allInventory = useInventory() || []
  
  const [showReports, setShowReports] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [showTransferHistory, setShowTransferHistory] = useState(false)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)
  const [transferIdToExpand, setTransferIdToExpand] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedShopTransactions, setSelectedShopTransactions] = useState<Transaction[] | null>(null)
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<any[]>([])
  const [inventoryAdditions, setInventoryAdditions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Calculate stats locally
  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    
    const dailySales = localTransactions
      .filter(tx => new Date(tx.createdAt).getTime() >= today)
      .reduce((sum, tx) => sum + tx.total, 0)
      
    const totalSales = localTransactions.reduce((sum, tx) => sum + tx.total, 0)
    
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
    const netProfit = allTransactionItems.reduce((sum, item) => {
      return sum + ((item.itemPrice - item.itemCost) * item.qty)
    }, 0)

    return {
      totalSales,
      dailySales,
      weeklySales: 0, 
      monthlySales: 0, 
      transactions: localTransactions.length,
      netProfit,
      lowStockCount,
      outOfStockCount,
      shopSummary: []
    }
  }, [localTransactions, allProducts, allTransactionItems, allInventory, allStores])

  const shopGroups = useMemo(() => {
    // Group transactions by store
    const groups: { [key: string]: any[] } = {}
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))
    
    localTransactions.forEach(tx => {
      const storeName = storeMap.get(tx.storeId) || tx.storeId 
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
          store: storeMap.get(t.storeId) || t.storeId,
          items: allTransactionItems.filter(item => item.transactionId === t.id)
        })),
        totalAmount,
        transactionCount: txs.length,
        firstDate: sorted[sorted.length - 1]?.createdAt.toISOString() || '',
        lastDate: sorted[0]?.createdAt.toISOString() || ''
      }
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
  }, [localTransactions, allStores])

  const todayTransactions = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))

    return localTransactions
      .filter(tx => new Date(tx.createdAt).getTime() >= today)
      .map(tx => ({
        ...tx,
        date: tx.createdAt.toISOString(),
        store: storeMap.get(tx.storeId) || 'Unknown Shop',
        items: allTransactionItems.filter(item => item.transactionId === tx.id)
      })) as unknown as Transaction[]
  }, [localTransactions, allStores, allTransactionItems])

  const transactionsWithStoreNames = useMemo(() => {
    const storeMap = new Map(allStores.map(s => [s.id, s.name]))
    return localTransactions.map(tx => ({
      ...tx,
      date: tx.createdAt.toISOString(),
      store: storeMap.get(tx.storeId) || 'Unknown Shop',
      items: allTransactionItems.filter(item => item.transactionId === tx.id)
    })) as unknown as Transaction[]
  }, [localTransactions, allStores, allTransactionItems])

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [transferRes, inventoryRes] = await Promise.all([
          fetch('/api/transfer'),
          fetch('/api/inventory/addition')
        ])
        
        if (transferRes.ok) {
          const transferData = await transferRes.json()
          if (Array.isArray(transferData)) {
            setTransfers(transferData)
          }
        }

        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json()
          if (Array.isArray(inventoryData)) {
            setInventoryAdditions(inventoryData)
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      }
    }

    fetchData()
  }, [])

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
    <div className="pt-0 px-2 pb-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <Button 
          variant="outline" 
          onClick={() => setShowReports(true)}
          className="flex items-center gap-2 mt-4"
        >
          <TrendingUp className="w-4 h-4" />
          Analytics & Reports
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Transactions"
          value={stats.transactions.toString()}
          trend={
            <>
              <CheckCircle className="w-3 h-3" />
              <span>Sales count</span>
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
              <span>Performance</span>
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
              <span>After costs</span>
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
              <span>Click to view all shop sales</span>
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
          title="LOW/ OUT OF STOCK"
          value={
            <span className="flex items-center gap-2">
              <span className="text-amber-600">Low: {stats.lowStockCount}</span>
              <span className="text-slate-300 font-normal">|</span>
              <span className="text-red-600">Out: {stats.outOfStockCount}</span>
            </span>
          }
          trend={
            <>
              <AlertTriangle className="w-3 h-3" />
              <span>Restock needed</span>
            </>
          }
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-white"
          onClick={() => setShowRestockModal(true)}
        />
        <StatCard
          title="Best Selling Product"
          value={bestSeller ? bestSeller.name : 'N/A'}
          trend={
            <>
              <TrendingUp className="w-3 h-3" />
              <span>{bestSeller ? `${bestSeller.qty} units sold` : 'No sales yet'}</span>
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
      <Card>
        <Table>
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
                    <TableCell className="font-medium">{shop.store}</TableCell>
                    <TableCell>
                      {shop.firstDate ? formatDateDDMMYYYY(shop.firstDate) : 'N/A'} - {shop.lastDate ? formatDateDDMMYYYY(shop.lastDate) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50">
                        {shop.transactionCount} transaction{shop.transactionCount !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-emerald-600">{formatCurrency(shop.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedStoreName(shop.store)
                          setSelectedShopTransactions(shop.transactions)
                        }}
                      >
                        View All
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

      {/* Recent Stock Transfers */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Stock Transfers</h3>
          <Badge variant="outline" className="bg-slate-50">
            Last {Math.min(transfers.length, 5)} transfers
          </Badge>
        </div>
        <Card>
          <Table>
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
                    <TableCell className="font-medium">#TR-{transfer.transferId}</TableCell>
                    <TableCell>{formatDateDDMMYYYY(transfer.createdAt)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{transfer.toStore}</span>
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
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px]">
                        {transfer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Recent Inventory History */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Inventory Additions</h3>
          <Badge variant="outline" className="bg-slate-50">
            Last {Math.min(inventoryAdditions.length, 5)} additions
          </Badge>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inventory ID</TableHead>
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
                    <TableCell className="font-medium">#INV-{addition.additionId}</TableCell>
                    <TableCell>{formatDateDDMMYYYY(addition.createdAt)}</TableCell>
                    <TableCell className="font-medium text-emerald-600">
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
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px]">
                        Completed
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                All Transactions {selectedStoreName ? `- ${selectedStoreName}` : ''}
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedShopTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">#{tx.transactionId}</TableCell>
                      <TableCell>{formatDateDDMMYYYY(tx.date)}</TableCell>
                      <TableCell>{tx.items?.length || 0} item{(tx.items?.length || 0) !== 1 ? 's' : ''}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(tx.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedTransaction(tx)}
                        >
                          View Receipt
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">{selectedShopTransactions.length}</span> transaction{selectedShopTransactions.length !== 1 ? 's' : ''} | 
                  <span className="font-medium ml-2">Total: {formatCurrency(selectedShopTransactions.reduce((sum, tx) => sum + tx.total, 0))}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedShopTransactions(null)}>
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
