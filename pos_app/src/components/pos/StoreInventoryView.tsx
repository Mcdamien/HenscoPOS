'use client'

import { useState, useEffect } from 'react'
import { Search, RotateCcw, Bell, Package, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ReturnStoreProductModal from '@/components/pos/ReturnStoreProductModal'
import TransferConfirmationModal from '@/components/pos/TransferConfirmationModal'
import { toast } from 'sonner'

interface StoreInventoryViewProps {
  stores: string[]
  currentStore: string
  onStoreChange: (store: string) => void
}

interface Product {
  id: string
  itemId: number
  name: string
  price: number
  warehouseStock: number
  inventories: {
    stock: number
  }[]
}

interface InventoryWithProduct extends Product {
  storeStock: number
}

interface PendingTransfer {
  id: string
  transferId: number
  fromStore: string | null
  toStore: string
  status: string
  createdAt: string
  items: {
    id: string
    itemName: string
    qty: number
  }[]
}

interface ApprovedReturn {
  id: string
  productId: string
  storeId: string
  qty: number
  changeType: string
  status: string
  product: {
    id: string
    itemId: number
    name: string
  }
  store: {
    id: string
    name: string
  }
}

export default function StoreInventoryView({ stores, currentStore, onStoreChange }: StoreInventoryViewProps) {
  const [products, setProducts] = useState<InventoryWithProduct[]>([])
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([])
  const [approvedReturns, setApprovedReturns] = useState<ApprovedReturn[]>([])
  const [pendingTransfersCount, setPendingTransfersCount] = useState(0)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<InventoryWithProduct | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchInventory = async () => {
    try {
      const response = await fetch(`/api/inventory?store=${encodeURIComponent(currentStore)}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingTransfers = async () => {
    if (!currentStore) return
    try {
      const response = await fetch(`/api/transfer/pending?store=${encodeURIComponent(currentStore)}`)
      if (response.ok) {
        const data = await response.json()
        setPendingTransfers(data.transfers || [])
        setPendingTransfersCount(data.count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch pending transfers:', error)
    }
  }

  const fetchApprovedReturns = async () => {
    if (!currentStore) return
    try {
      // Fetch approved returns for this store
      const response = await fetch('/api/inventory/pending-changes?status=approved')
      if (response.ok) {
        const data = await response.json()
        // Filter returns for this store
        const storeReturns = (data.changes || []).filter(
          (change: ApprovedReturn) => 
            change.store?.name === currentStore && 
            change.changeType === 'return' &&
            change.status === 'approved'
        )
        setApprovedReturns(storeReturns)
      }
    } catch (error) {
      console.error('Failed to fetch approved returns:', error)
    }
  }

  useEffect(() => {
    fetchInventory()
    fetchPendingTransfers()
    fetchApprovedReturns()
  }, [currentStore])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', className: 'bg-red-100 text-red-700' }
    if (stock < 11) return { label: 'Low Stock', className: 'bg-amber-100 text-amber-700' }
    return { label: 'In Stock', className: 'bg-emerald-100 text-emerald-700' }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.itemId).includes(searchTerm)
  )

  // Helper to get approved return qty for a product
  const getApprovedReturnQtyForProduct = (productId: string) => {
    return approvedReturns
      .filter(r => r.productId === productId)
      .reduce((sum, r) => sum + r.qty, 0)
  }

  // Get total items in pending transfers
  const getTotalPendingTransferItems = () => {
    return pendingTransfers.reduce((sum, t) => sum + t.items.length, 0)
  }

  // Get total units in pending transfers
  const getTotalPendingTransferUnits = () => {
    return pendingTransfers.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.qty, 0), 0)
  }

  const confirmReturn = async (productId: string) => {
    try {
      const response = await fetch(`/api/inventory/confirm-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productId,
          storeName: currentStore
        })
      });

      if (response.ok) {
        // Remove the confirmed return from approvedReturns
        setApprovedReturns(prev => prev.filter(returnItem => returnItem.productId !== productId));
        toast.success('Return alert cleared')
      }
    } catch (error) {
      console.error('Failed to confirm return:', error);
      toast.error('Failed to clear return alert')
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <Card>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Store Front Inventory</h3>
            <Select value={currentStore} onValueChange={onStoreChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select store" />
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
          <div className="flex items-center gap-3">
            {/* Pending Transfers Notification */}
            {pendingTransfersCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowConfirmationModal(true)}
                className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                <Bell className="w-4 h-4 mr-2" />
                Transfers
                <Badge variant="destructive" className="ml-2">
                  {pendingTransfersCount}
                </Badge>
              </Button>
            )}
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search store stock..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item ID</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
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
                const status = getStockStatus(product.storeStock)
                const approvedReturnQty = getApprovedReturnQtyForProduct(product.id)
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">#{product.itemId}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{currentStore}</TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>{product.storeStock}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={status.className}>{status.label}</Badge>
                        {approvedReturnQty > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                            onClick={() => confirmReturn(product.id)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {approvedReturnQty} returned
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product)
                          setShowReturnModal(true)
                        }}
                        disabled={product.storeStock === 0}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Return
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Return Modal */}
      {showReturnModal && selectedProduct && (
        <ReturnStoreProductModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false)
            setSelectedProduct(null)
          }}
          onSuccess={() => {
            setShowReturnModal(false)
            setSelectedProduct(null)
            fetchInventory()
            fetchApprovedReturns()
          }}
          product={{
            id: selectedProduct.id,
            itemId: selectedProduct.itemId,
            name: selectedProduct.name,
            price: selectedProduct.price,
            warehouseStock: selectedProduct.warehouseStock
          }}
          currentStore={currentStore}
          currentStoreStock={selectedProduct.storeStock}
        />
      )}

      {/* Transfer Confirmation Modal */}
      {showConfirmationModal && (
        <TransferConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          onRefresh={fetchPendingTransfers}
          currentStore={currentStore}
          transfers={pendingTransfers}
        />
      )}
    </div>
  )
}
