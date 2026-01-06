'use client'

import { useState, useEffect } from 'react'
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
  id: number
  date: string
  total: number
  subtotal: number
  tax: number
  items: any[]
  store: string // Added the missing store property
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
  const [showReports, setShowReports] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [showTransferHistory, setShowTransferHistory] = useState(false)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)
  const [transferIdToExpand, setTransferIdToExpand] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedShopTransactions, setSelectedShopTransactions] = useState<Transaction[] | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [inventoryAdditions, setInventoryAdditions] = useState<any[]>([])
  const [shopGroups, setShopGroups] = useState<ShopGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    transactions: 0,
    netProfit: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    shopSummary: []
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, txRes, transferRes, inventoryRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/transactions'),
          fetch('/api/transfer'),
          fetch('/api/inventory/addition')
        ])
        
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
        }
        
        if (txRes.ok) {
          const txData = await txRes.json()
          setTransactions(txData)
          // Group transactions by shop
          setShopGroups(groupTransactionsByShop(txData))
        }

        if (transferRes.ok) {
          const transferData = await transferRes.json()
          setTransfers(transferData)
        }

        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json()
          setInventoryAdditions(inventoryData)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  // Group transactions by store
  const groupTransactionsByShop = (txList: Transaction[]): ShopGroup[] => {
    const groups: { [key: string]: Transaction[] } = {}
    
    // Group by store
    txList.forEach(tx => {
      if (!groups[tx.store]) {
        groups[tx.store] = []
      }
      groups[tx.store].push(tx)
    })
    
    // Convert to ShopGroup array with totals
    return Object.entries(groups).map(([store, txs]) => {
      // Sort transactions by date (newest first)
      const sorted = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const totalAmount = txs.reduce((sum, tx) => sum + tx.total, 0)
      
      return {
        store,
        transactions: sorted,
        totalAmount,
        transactionCount: txs.length,
        firstDate: sorted[sorted.length - 1]?.date || '',
        lastDate: sorted[0]?.date || ''
      }
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()) // Sort by most recent
  }

  const StatCard = ({ title, value, trend, icon: Icon, trendColor, onClick }: any) => (
    <Card 
      className={cn(
        "transition-all",
        onClick && "cursor-pointer hover:border-emerald-500 hover:shadow-md active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
            <div className={`flex items-center gap-1 text-xs mt-2 ${trendColor}`}>
              {trend}
            </div>
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100">
            <Icon className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <Button 
          variant="outline" 
          onClick={() => setShowReports(true)}
          className="flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Analytics & Reports
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Transactions"
          value={stats.transactions}
          trend={
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Click to view sales analytics</span>
            </>
          }
          icon={CheckCircle}
          trendColor="text-emerald-600"
          onClick={() => setShowReports(true)}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalSales)}
          trend={
            <>
              <BarChart3 className="w-4 h-4" />
              <span>View company performance</span>
            </>
          }
          icon={DollarSign}
          trendColor="text-blue-600"
          onClick={() => setShowReports(true)}
        />
        <StatCard
          title="Estimated Net Profit"
          value={formatCurrency(stats.netProfit)}
          trend={
            <>
              <PiggyBank className="w-4 h-4" />
              <span>Total profit after costs</span>
            </>
          }
          icon={PiggyBank}
          trendColor="text-emerald-600"
        />
        <Card 
          className="cursor-pointer hover:border-amber-500 hover:shadow-md active:scale-[0.98] transition-all"
          onClick={() => setShowRestockModal(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Inventory Status</p>
                <div className="mt-3 space-y-2">
                  {/* Out of Stock */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100">
                      <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Out of Stock</p>
                      <p className="text-xl font-bold text-red-600">{stats.outOfStockCount}</p>
                    </div>
                  </div>
                  {/* Low Stock */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Low Stock</p>
                      <p className="text-xl font-bold text-amber-600">{stats.lowStockCount}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs mt-3 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Click to view restock details</span>
                </div>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
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
                      {formatDateDDMMYYYY(shop.firstDate)} - {formatDateDDMMYYYY(shop.lastDate)}
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
                        onClick={() => setSelectedShopTransactions(shop.transactions)}
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
          transactions={transactions}
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
                All Transactions - {selectedShopTransactions[0]?.store}
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
                      <TableCell className="font-medium">#{tx.id}</TableCell>
                      <TableCell>{formatDateDDMMYYYY(tx.date)}</TableCell>
                      <TableCell>{tx.items.length} item{tx.items.length !== 1 ? 's' : ''}</TableCell>
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
            fetch('/api/dashboard/stats')
              .then(res => res.json())
              .then(data => setStats(prev => ({ ...prev, ...data })))
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

