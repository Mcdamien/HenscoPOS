'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, FileSpreadsheet, Bell, Package, Truck, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AddInventoryModal from '@/components/pos/AddInventoryModal'
import ImportProductsModal from '@/components/pos/ImportProductsModal'
import EditProductModal from '@/components/pos/EditProductModal'
import PendingApprovalsModal from '@/components/pos/PendingApprovalsModal'
import TransferHistoryModal from '@/components/pos/TransferHistoryModal'
import TransferModal from '@/components/pos/TransferModal'

interface Product {
  id: string
  itemId: number
  name: string
  cost: number
  price: number
  warehouseStock: number
  restockQty: number
}

interface PendingChange {
  id: string
  productId: string
  changeType: string
  qty: number
  store: {
    name: string
  }
}

interface WarehouseViewProps {
  stores: string[]
  currentStore: string
  onStoreChange: (store: string) => void
}

export default function WarehouseView({ stores, currentStore, onStoreChange }: WarehouseViewProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showTransferHistoryModal, setShowTransferHistoryModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingTransfersCount, setPendingTransfersCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/inventory/pending-changes?status=pending')
      if (response.ok) {
        const data = await response.json()
        setPendingChanges(data.changes)
        setPendingCount(data.count)
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error)
    }
  }

  const fetchPendingTransfers = async () => {
    try {
      const response = await fetch('/api/transfer?status=pending')
      if (response.ok) {
        const data = await response.json()
        const pending = data.filter((t: any) => t.status === 'pending')
        setPendingTransfers(pending)
        setPendingTransfersCount(pending.length)
      }
    } catch (error) {
      console.error('Failed to fetch pending transfers:', error)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchPendingCount()
    fetchPendingTransfers()
    
    // Auto-focus search input on mount
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', className: 'bg-red-100 text-red-700' }
    if (stock < 10) return { label: 'Low Stock', className: 'bg-amber-100 text-amber-700' }
    return { label: 'In Stock', className: 'bg-emerald-100 text-emerald-700' }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.itemId).includes(searchTerm)
  )

  // Helper to get pending returns for a product
  const getPendingReturnsForProduct = (productId: string) => {
    return pendingChanges.filter(
      change => change.productId === productId && change.changeType === 'return'
    )
  }

  // Helper to get total pending return qty for a product
  const getTotalPendingReturnQty = (productId: string) => {
    const returns = getPendingReturnsForProduct(productId)
    return returns.reduce((sum, r) => sum + r.qty, 0)
  }

  // Helper to get transfer status badge
  const getTransferStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled'
    }
    const icons: Record<string, any> = {
      pending: Clock,
      confirmed: CheckCircle,
      cancelled: XCircle
    }
    
    const Icon = icons[status] || Clock
    return (
      <Badge className={styles[status] || 'bg-slate-100 text-slate-700'}>
        <Icon className="w-3 h-3 mr-1" />
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Central Warehouse Stock</h3>
              <Select value={currentStore} onValueChange={onStoreChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select shop" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store} value={store}>
                      {store}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {/* Pending Approvals Button */}
            <Button 
              onClick={() => setShowPendingModal(true)} 
              variant="outline"
              className={pendingCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}
            >
              <Bell className="w-4 h-4 mr-2" />
              Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </Button>

            {/* Transfer History Button */}
            <Button 
              onClick={() => setShowTransferHistoryModal(true)}
              variant="outline"
              className={pendingTransfersCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}
            >
              <Truck className="w-4 h-4 mr-2" />
              Transfers
              {pendingTransfersCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingTransfersCount}
                </Badge>
              )}
            </Button>

            {/* Added Transfer Button */}
            <Button onClick={() => setShowTransferModal(true)}>
              <Truck className="w-4 h-4 mr-2" />
              Transfer Stock
            </Button>

            <Button onClick={() => setShowImportModal(true)} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Excel
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Inventory
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item ID</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const status = getStockStatus(product.warehouseStock)
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">#{product.itemId}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{formatCurrency(product.cost)}</TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>{product.warehouseStock}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={status.className}>{status.label}</Badge>
                        {getTotalPendingReturnQty(product.id) > 0 && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 border-amber-200 text-amber-700 text-xs"
                          >
                            ↩ {getTotalPendingReturnQty(product.id)} returning
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product)
                          setShowEditModal(true)
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modals */}
      {showAddModal && (
        <AddInventoryModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          products={products}
          onSuccess={fetchProducts}
        />
      )}

      {showImportModal && (
        <ImportProductsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={fetchProducts}
        />
      )}

      {showEditModal && selectedProduct && (
        <EditProductModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedProduct(null)
          }}
          onSuccess={fetchProducts}
          product={selectedProduct}
        />
      )}

      {showPendingModal && (
        <PendingApprovalsModal
          isOpen={showPendingModal}
          onClose={() => setShowPendingModal(false)}
          onRefresh={fetchPendingCount}
        />
      )}

      {/* Transfer History Modal */}
      {showTransferHistoryModal && (
        <TransferHistoryModal
          isOpen={showTransferHistoryModal}
          onClose={() => setShowTransferHistoryModal(false)}
          onRefresh={fetchPendingTransfers}
        />
      )}

      {/* Added Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          stores={stores}
          currentStore={currentStore}
          products={products}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  )
}
