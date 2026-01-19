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
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Edit, Trash } from 'lucide-react'

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
  const isMobile = useIsMobile()
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
    <div className="pt-0 px-0 sm:px-2 pb-8 h-full overflow-y-auto bg-slate-50/30">
      <Card className="rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-white">
          <div className={cn(
            "flex items-center justify-between mb-4 gap-4",
            isMobile && "flex-col items-stretch"
          )}>
            <div className={cn(
              "flex items-center gap-4",
              isMobile && "flex-col items-stretch"
            )}>
              <h3 className="text-lg font-bold text-slate-800">Central Warehouse</h3>
              <Select value={currentStore} onValueChange={onStoreChange}>
                <SelectTrigger className={cn("w-64", isMobile && "w-full h-11")}>
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
                className={cn("pl-10 w-72", isMobile && "w-full h-11")}
              />
            </div>
          </div>
          
          <div className={cn(
            "flex items-center justify-end gap-2 sm:gap-3",
            isMobile && "grid grid-cols-2"
          )}>
            {/* Pending Approvals Button */}
            <Button 
              onClick={() => setShowPendingModal(true)} 
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className={cn(
                "h-10 font-bold",
                pendingCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : '',
                isMobile && "w-full"
              )}
            >
              <Bell className="w-4 h-4 mr-2" />
              Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5 h-5 min-w-[20px] justify-center">
                  {pendingCount}
                </Badge>
              )}
            </Button>

            {/* Transfer History Button */}
            <Button 
              onClick={() => setShowTransferHistoryModal(true)}
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className={cn(
                "h-10 font-bold",
                pendingTransfersCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : '',
                isMobile && "w-full"
              )}
            >
              <Truck className="w-4 h-4 mr-2" />
              Transfers
              {pendingTransfersCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5 h-5 min-w-[20px] justify-center">
                  {pendingTransfersCount}
                </Badge>
              )}
            </Button>

            {/* Added Transfer Button */}
            <Button 
              onClick={() => setShowTransferModal(true)}
              size={isMobile ? "sm" : "default"}
              className={cn("h-10 font-bold bg-slate-900", isMobile && "w-full")}
            >
              <Truck className="w-4 h-4 mr-2 text-slate-400" />
              Transfer
            </Button>

            <Button 
              onClick={() => setShowAddModal(true)}
              size={isMobile ? "sm" : "default"}
              className={cn("h-10 font-bold bg-emerald-600 hover:bg-emerald-700", isMobile && "w-full")}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isMobile ? "Add" : "Add Inventory"}
            </Button>

            {isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 w-10 p-0 col-span-2 mx-auto mt-2">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-slate-400" />
                    Import Excel
                  </DropdownMenuItem>
                  {selectedProductIds.size > 0 && (
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() => setShowBatchDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedProductIds.size})
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button onClick={() => setShowImportModal(true)} variant="outline" className="h-10 font-medium">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-slate-400" />
                  Import
                </Button>
                {selectedProductIds.size > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowBatchDeleteDialog(true)}
                    className="h-10 font-medium"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedProductIds.size})
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {isMobile ? (
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-center py-12 text-slate-500 font-medium">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-medium">No products found</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product.warehouseStock)
                  const isSelected = selectedProductIds.has(product.id)
                  const pendingReturnQty = getTotalPendingReturnQty(product.id)

                  return (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "p-4 border shadow-sm transition-all",
                        isSelected && "border-slate-400 ring-1 ring-slate-400/20"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-slate-300 mt-1"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400">#{product.itemId}</span>
                                <Badge className={cn("text-[10px] px-1.5 py-0", status.className)}>
                                  {status.label}
                                </Badge>
                              </div>
                              <h4 className="font-bold text-slate-800">{product.name}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">{formatCurrency(product.price)}</p>
                              <p className="text-[11px] font-medium text-slate-500">Stock: {product.warehouseStock}</p>
                            </div>
                          </div>

                          {pendingReturnQty > 0 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span className="text-[11px] font-bold text-amber-600 uppercase">
                                ↩ {pendingReturnQty} items returning to warehouse
                              </span>
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-9 text-xs font-bold border-slate-200"
                              onClick={() => {
                                setSelectedProduct(product)
                                setShowEditModal(true)
                              }}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-10 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100"
                              onClick={() => {
                                setProductToDelete(product)
                                setShowDeleteDialog(true)
                              }}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300"
                    checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-bold text-slate-700">Item ID</TableHead>
                <TableHead className="font-bold text-slate-700">Product Name</TableHead>
                <TableHead className="font-bold text-slate-700">Cost</TableHead>
                <TableHead className="font-bold text-slate-700">Price</TableHead>
                <TableHead className="font-bold text-slate-700">Stock</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-12 font-medium">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-12 font-medium">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product.warehouseStock)
                  return (
                    <TableRow key={product.id} className={cn(
                      "group hover:bg-slate-50/50 transition-colors",
                      selectedProductIds.has(product.id) ? 'bg-slate-50' : ''
                    )}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-500 uppercase text-[11px]">#{product.itemId}</TableCell>
                      <TableCell className="font-bold text-slate-800">{product.name}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(product.cost)}</TableCell>
                      <TableCell className="font-bold text-slate-900">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="font-bold text-slate-700">{product.warehouseStock}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("font-bold text-[10px] uppercase px-2", status.className)}>{status.label}</Badge>
                          {getTotalPendingReturnQty(product.id) > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold uppercase"
                            >
                              ↩ {getTotalPendingReturnQty(product.id)} returning
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedProduct(product)
                              setShowEditModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4 text-slate-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
        )}
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
