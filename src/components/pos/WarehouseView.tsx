'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Search, FileSpreadsheet, Bell, Package, Truck, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
} from "@/components/ui/alert-dialog"
import AddInventoryModal from '@/components/pos/AddInventoryModal'
import ImportProductsModal from '@/components/pos/ImportProductsModal'
import EditProductModal from '@/components/pos/EditProductModal'
import PendingApprovalsModal from '@/components/pos/PendingApprovalsModal'
import TransferHistoryModal from '@/components/pos/TransferHistoryModal'
import TransferModal from '@/components/pos/TransferModal'
import { useProducts, usePendingChanges, useTransfers, useStores } from "@/hooks/useOfflineData"
import { useSync } from '@/components/providers/SyncProvider'
import { dexieDb } from '@/lib/dexie'
import { toast } from 'sonner'

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
  const products = useProducts() || []
  const offlinePendingChanges = usePendingChanges() || []
  const offlineTransfers = useTransfers() || []
  const { sync } = useSync()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showTransferHistoryModal, setShowTransferHistoryModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const allStores = useStores() || []

  const currentStoreId = useMemo(() => {
    return allStores.find(s => s.name === currentStore)?.id
  }, [allStores, currentStore])

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.itemId).includes(searchTerm)
    )
  }, [products, searchTerm])

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProductIds)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProductIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set())
    } else {
      setSelectedProductIds(new Set(filteredProducts.filter(p => p !== null).map(p => p.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedProductIds.size === 0) return

    try {
      await dexieDb.transaction('rw', dexieDb.products, dexieDb.syncQueue, async () => {
        const idsArray = Array.from(selectedProductIds)
        
        // 1. Delete locally
        await dexieDb.products.bulkDelete(idsArray)

        // 2. Add to sync queue
        for (const id of idsArray) {
          await dexieDb.syncQueue.add({
            table: 'products',
            action: 'delete',
            data: { id },
            timestamp: Date.now()
          })
        }
      })

      toast.success(`${selectedProductIds.size} products deleted successfully`)
      setSelectedProductIds(new Set())
      sync()
    } catch (error) {
      console.error('Failed to batch delete products:', error)
      toast.error('Failed to delete products')
    } finally {
      setShowBatchDeleteDialog(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return

    try {
      await dexieDb.transaction('rw', dexieDb.products, dexieDb.syncQueue, async () => {
        // 1. Delete locally
        await dexieDb.products.delete(productToDelete.id)

        // 2. Add to sync queue
        await dexieDb.syncQueue.add({
          table: 'products',
          action: 'delete',
          data: { id: productToDelete.id },
          timestamp: Date.now()
        })
      })

      toast.success('Product deleted successfully')
      sync()
    } catch (error) {
      console.error('Failed to delete product:', error)
      toast.error('Failed to delete product')
    } finally {
      setShowDeleteDialog(false)
      setProductToDelete(null)
    }
  }

  const pendingChanges = useMemo(() => {
    return offlinePendingChanges.filter(c => c.status === 'pending')
  }, [offlinePendingChanges])

  const pendingTransfers = useMemo(() => {
    return offlineTransfers.filter(t => t.status === 'pending')
  }, [offlineTransfers])

  const pendingCount = pendingChanges.length
  const pendingTransfersCount = pendingTransfers.length

  useEffect(() => {
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

  // Helper to get pending returns for a product
  const getPendingReturnsForProduct = (productId: string) => {
    return pendingChanges.filter(
      change => change.productId === productId && (change.changeType === 'return' || change.changeType === 'remove_product')
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
    <div className="pt-0 px-2 pb-8 h-full overflow-y-auto">
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
            {selectedProductIds.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowBatchDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedProductIds.size})
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300"
                  checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                  onChange={toggleSelectAll}
                />
              </TableHead>
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
                  <TableRow key={product.id} className={selectedProductIds.has(product.id) ? 'bg-slate-50' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                      />
                    </TableCell>
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
                      <div className="flex justify-end gap-2">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={() => {
                            setProductToDelete(product)
                            setShowDeleteDialog(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
          onSuccess={sync}
        />
      )}

      {showImportModal && (
        <ImportProductsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={sync}
        />
      )}

      {showEditModal && selectedProduct && (
        <EditProductModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedProduct(null)
          }}
          onSuccess={sync}
          product={selectedProduct}
        />
      )}

      {showPendingModal && (
        <PendingApprovalsModal
          isOpen={showPendingModal}
          onClose={() => setShowPendingModal(false)}
          onRefresh={sync}
        />
      )}

      {/* Transfer History Modal */}
      {showTransferHistoryModal && (
        <TransferHistoryModal
          isOpen={showTransferHistoryModal}
          onClose={() => setShowTransferHistoryModal(false)}
          onRefresh={sync}
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
          onSuccess={sync}
        />
      )}

      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedProductIds.size} selected products from the central warehouse. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Products
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product
              {productToDelete && <span className="font-semibold"> {productToDelete.name} </span>}
              from the system and all warehouse records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
