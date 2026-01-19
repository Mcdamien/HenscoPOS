'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, RotateCcw, Bell, Package, Clock, Trash2 } from 'lucide-react'
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
import ReturnStoreProductModal from '@/components/pos/ReturnStoreProductModal'
import TransferConfirmationModal, { type Transfer } from '@/components/pos/TransferConfirmationModal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useProducts, useInventory, useTransfers, usePendingChanges, useTransferItems, useStores } from '@/hooks/useOfflineData'
import { dexieDb } from '@/lib/dexie'
import { useSync } from '@/components/providers/SyncProvider'
import { v4 as uuidv4 } from 'uuid'

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
}

interface InventoryWithProduct extends Product {
  storeStock: number
  isPendingRemoval: boolean
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

import { useIsMobile } from '@/hooks/use-mobile'

export default function StoreInventoryView({ stores, currentStore, onStoreChange }: StoreInventoryViewProps) {
  const isMobile = useIsMobile()
  const allProducts = useProducts() || []
  const storeInventory = useInventory() || []
  const allTransfers = useTransfers() || []
  const allTransferItems = useTransferItems() || []
  const allPendingChanges = usePendingChanges() || []
  const allStores = useStores() || []
  const { isOnline, sync } = useSync()
  
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<InventoryWithProduct | null>(null)
  const [productToRemove, setProductToRemove] = useState<InventoryWithProduct | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showBatchRemoveDialog, setShowBatchRemoveDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  const currentStoreId = useMemo(() => {
    return allStores.find(s => s.name === currentStore)?.id
  }, [allStores, currentStore])

  // Derived products for the current store
  const products = useMemo(() => {
    if (!currentStoreId) return []

    return allProducts.map(p => {
      const inv = storeInventory.find(i => i.productId === p.id && i.storeId === currentStoreId)
      
      // Check if there's a pending removal for this product
      const isPendingRemoval = allPendingChanges.some(c => 
        c.productId === p.id && 
        c.storeId === currentStoreId && 
        c.changeType === 'remove_product' && 
        c.status === 'pending'
      )

      if (!inv && !isPendingRemoval) return null

      return {
        id: p.id,
        itemId: p.itemId,
        name: p.name,
        price: p.price,
        warehouseStock: p.warehouseStock,
        storeStock: inv ? inv.stock : 0,
        isPendingRemoval
      }
    }).filter((p): p is InventoryWithProduct => p !== null)
  }, [allProducts, storeInventory, currentStoreId, allPendingChanges])

  const pendingTransfers = useMemo(() => {
    return allTransfers
      .filter(t => t.toStore === currentStore && t.status === 'pending')
      .map(t => ({
        ...t,
        items: allTransferItems.filter(item => item.stockTransferId === t.id)
      })) as Transfer[]
  }, [allTransfers, allTransferItems, currentStore])

  const approvedReturns = useMemo(() => {
    if (!currentStoreId) return []

    return allPendingChanges.filter(c => 
      c.storeId === currentStoreId && 
      (c.changeType === 'return' || c.changeType === 'remove_product') && 
      c.status === 'approved'
    )
  }, [allPendingChanges, currentStoreId])

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

  const handleBatchRemove = async () => {
    if (selectedProductIds.size === 0) return

    try {
      if (!currentStoreId) {
        toast.error('Store ID not found')
        return
      }

      const productsToRemove = filteredProducts.filter(p => p !== null && selectedProductIds.has(p.id))
      
      await dexieDb.transaction('rw', [dexieDb.inventories, dexieDb.pendingChanges, dexieDb.syncQueue], async () => {
        for (const product of productsToRemove) {
          if (!product) continue
          if (product.storeStock > 0) {
            // Approval required
            const removeData = {
              productId: product.id,
              storeId: currentStoreId,
              changeType: 'remove_product',
              qty: product.storeStock,
              reason: 'Batch removal from shop - stock returning to warehouse',
              requestedBy: 'Store Manager'
            }

            const newChangeId = uuidv4()
            await dexieDb.pendingChanges.add({
              id: newChangeId,
              productId: removeData.productId,
              storeId: removeData.storeId,
              changeType: removeData.changeType,
              qty: removeData.qty,
              reason: removeData.reason,
              status: 'pending',
              requestedBy: removeData.requestedBy,
              createdAt: new Date(),
              updatedAt: new Date()
            })

            await dexieDb.syncQueue.add({
              table: 'pendingChanges',
              action: 'create',
              data: removeData,
              timestamp: Date.now()
            })
          } else {
            // Direct delete
            const inventory = await dexieDb.inventories
              .where('[storeId+productId]')
              .equals([currentStoreId, product.id])
              .first()

            if (inventory) {
              await dexieDb.inventories.delete(inventory.id)
              await dexieDb.syncQueue.add({
                table: 'inventories',
                action: 'delete',
                data: {
                  productId: product.id,
                  storeId: currentStoreId
                },
                timestamp: Date.now()
              })
            }
          }
        }
      })

      toast.success(`${selectedProductIds.size} products processed for removal`)
      setSelectedProductIds(new Set())
      sync()
    } catch (error) {
      console.error('Failed to batch remove products:', error)
      toast.error('Failed to remove products')
    } finally {
      setShowBatchRemoveDialog(false)
    }
  }

  const handleRemoveFromShop = async () => {
    if (!productToRemove) return

    try {
      if (!currentStoreId) {
        toast.error('Store ID not found')
        return
      }

      // Find the specific inventory record
      const inventory = await dexieDb.inventories
        .where('[storeId+productId]')
        .equals([currentStoreId, productToRemove.id])
        .first()

      if (!inventory) {
        toast.error('Inventory record not found')
        return
      }

      // If there is stock, we MUST use the approval process to return stock to warehouse
      if (productToRemove.storeStock > 0) {
        if (!currentStoreId) {
          toast.error('Store ID not found')
          return
        }

        const removeData = {
          productId: productToRemove.id,
          storeId: currentStoreId,
          changeType: 'remove_product',
          qty: productToRemove.storeStock,
          reason: 'Product removed from shop - stock returning to warehouse',
          requestedBy: 'Store Manager'
        }

        const newChangeId = uuidv4()
        await dexieDb.transaction('rw', dexieDb.pendingChanges, dexieDb.syncQueue, async () => {
          await dexieDb.pendingChanges.add({
            id: newChangeId,
            productId: removeData.productId,
            storeId: removeData.storeId,
            changeType: removeData.changeType,
            qty: removeData.qty,
            reason: removeData.reason,
            status: 'pending',
            requestedBy: removeData.requestedBy,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          await dexieDb.syncQueue.add({
            table: 'pendingChanges',
            action: 'create',
            data: removeData,
            timestamp: Date.now()
          })
        })

        toast.success('Removal request submitted for approval')
      } else {
        // If no stock, just delete directly
        await dexieDb.transaction('rw', dexieDb.inventories, dexieDb.syncQueue, async () => {
          // 1. Delete locally
          await dexieDb.inventories.delete(inventory.id)

          // 2. Add to sync queue
          await dexieDb.syncQueue.add({
            table: 'inventories',
            action: 'delete',
            data: {
              productId: productToRemove.id,
              storeId: currentStoreId
            },
            timestamp: Date.now()
          })
        })
        toast.success('Product removed from shop successfully')
      }

      sync()
    } catch (error) {
      console.error('Failed to remove product from shop:', error)
      toast.error('Failed to remove product from shop')
    } finally {
      setShowRemoveDialog(false)
      setProductToRemove(null)
    }
  }

  const pendingTransfersCount = pendingTransfers.length

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
      const returnChange = approvedReturns.find(r => r.productId === productId)
      if (!returnChange) return

      const confirmData = {
        pendingChangeId: returnChange.id,
        productId,
        storeId: currentStoreId
      }

      // 1. Update locally
      await dexieDb.transaction('rw', [dexieDb.pendingChanges, dexieDb.syncQueue, dexieDb.inventories], async () => {
        await dexieDb.pendingChanges.update(returnChange.id, {
          status: 'completed',
          updatedAt: new Date()
        })

        // If this was a product removal request, we also need to delete the inventory record
        if (returnChange.changeType === 'remove_product') {
          const inventory = await dexieDb.inventories
            .where('[storeId+productId]')
            .equals([currentStoreId as string, productId])
            .first()
          
          if (inventory) {
            await dexieDb.inventories.delete(inventory.id)
            
            // Add inventory deletion to sync queue
            await dexieDb.syncQueue.add({
              table: 'inventories',
              action: 'delete',
              data: {
                productId,
                storeId: currentStoreId
              },
              timestamp: Date.now()
            })
          }
        }

        // 2. Add pending change update to sync queue
        await dexieDb.syncQueue.add({
          table: 'pendingChanges',
          action: 'update',
          data: { ...confirmData, action: 'confirm-return' },
          timestamp: Date.now()
        })
      })

      toast.success('Return alert cleared locally')
      
      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to confirm return:', error)
      toast.error('Failed to clear return alert')
    }
  }

  return (
    <div className="pt-0 px-2 md:px-4 pb-8 h-full overflow-y-auto">
      <Card className="border-none md:border shadow-none md:shadow-sm">
        <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
            <h3 className="text-lg font-semibold whitespace-nowrap">Shop Inventory</h3>
            <Select value={currentStore} onValueChange={onStoreChange}>
              <SelectTrigger className="w-full sm:w-64 bg-slate-50 border-slate-200">
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
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {pendingTransfersCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowConfirmationModal(true)}
                className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 h-10 px-4 flex items-center justify-center"
              >
                <Bell className="w-4 h-4 mr-2" />
                <span className="md:hidden lg:inline">Transfers</span>
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0">
                  {pendingTransfersCount}
                </Badge>
              </Button>
            )}
            
            {selectedProductIds.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowBatchRemoveDialog(true)}
                className="h-10 px-4 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Remove</span> ({selectedProductIds.size})
              </Button>
            )}
            
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64 h-10 bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        </div>

        {isMobile ? (
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-center text-slate-500 py-12">Loading inventory...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-slate-500 py-12">No products found</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product.storeStock)
                  const approvedReturnQty = getApprovedReturnQtyForProduct(product.id)
                  const isSelected = selectedProductIds.has(product.id)
                  
                  return (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "p-4 border shadow-sm transition-all",
                        product.isPendingRemoval ? "opacity-60 bg-orange-50/20" : "bg-white",
                        isSelected && "border-emerald-500 ring-1 ring-emerald-500/20 shadow-emerald-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-slate-300 mt-0.5 accent-emerald-600"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(product.id)}
                          disabled={product.isPendingRemoval}
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">#{product.itemId}</span>
                                <Badge className={cn("text-[9px] px-1.5 h-4 uppercase font-black", status.className)}>
                                  {status.label}
                                </Badge>
                              </div>
                              <h4 className="font-bold text-slate-800 leading-tight">{product.name}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-emerald-600 leading-none">{formatCurrency(product.price)}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Stock: {product.storeStock}</p>
                            </div>
                          </div>

                          {product.isPendingRemoval && (
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-orange-600" />
                              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                                Pending Removal Approval
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {approvedReturnQty > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                onClick={() => confirmReturn(product.id)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1.5" />
                                {approvedReturnQty} RETURNED - CLEAR ALERT
                              </Button>
                            )}
                            
                            <div className="flex gap-2 w-full mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9 text-xs font-bold"
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setShowReturnModal(true)
                                }}
                                disabled={product.storeStock === 0 || product.isPendingRemoval}
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                Return Stock
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-12 h-9 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                onClick={() => {
                                  setProductToRemove(product)
                                  setShowRemoveDialog(true)
                                }}
                                disabled={product.isPendingRemoval}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-12 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 accent-emerald-600"
                      checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase">Item ID</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase">Product Name</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase">Location</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase">Price</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase text-center">Stock</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-12">
                      Loading products...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-12">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product.storeStock)
                    const approvedReturnQty = getApprovedReturnQtyForProduct(product.id)
                    const isSelected = selectedProductIds.has(product.id)
                    return (
                      <TableRow key={product.id} className={cn(
                        "transition-colors",
                        product.isPendingRemoval && "opacity-60 bg-orange-50/10",
                        isSelected && "bg-emerald-50/30"
                      )}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 accent-emerald-600"
                            checked={isSelected}
                            onChange={() => toggleProductSelection(product.id)}
                            disabled={product.isPendingRemoval}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">#{product.itemId}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{product.name}</span>
                            {product.isPendingRemoval && (
                              <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Pending Removal & Return
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-600">{currentStore}</TableCell>
                        <TableCell className="font-bold text-slate-700">{formatCurrency(product.price)}</TableCell>
                        <TableCell className="text-center font-black text-slate-800">{product.storeStock}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.isPendingRemoval ? (
                              <Badge className="bg-orange-100 text-orange-700 border-none uppercase text-[10px] font-black">Pending Approval</Badge>
                            ) : (
                              <Badge className={cn("border-none uppercase text-[10px] font-black", status.className)}>{status.label}</Badge>
                            )}
                            {approvedReturnQty > 0 && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer shadow-sm hover:bg-emerald-200 transition-colors"
                                onClick={() => confirmReturn(product.id)}
                              >
                                <RotateCcw className="w-3 h-3" />
                                {approvedReturnQty} RETURNED
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] font-bold"
                              onClick={() => {
                                setSelectedProduct(product)
                                setShowReturnModal(true)
                              }}
                              disabled={product.storeStock === 0 || product.isPendingRemoval}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                              Return
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100"
                              onClick={() => {
                                setProductToRemove(product)
                                setShowRemoveDialog(true)
                              }}
                              disabled={product.isPendingRemoval}
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
          </div>
        )}
      </Card>

      {/* Batch Remove Confirmation */}
      <AlertDialog open={showBatchRemoveDialog} onOpenChange={setShowBatchRemoveDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedProductIds.size} products?</AlertDialogTitle>
            <AlertDialogDescription>
              This will process {selectedProductIds.size} selected products for removal from <span className="font-semibold">{currentStore}</span>.
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p>Products with stock will create <b>return requests</b> for approval.</p>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <p>Products without stock will be <b>removed immediately</b>.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Batch Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            sync()
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
          onRefresh={sync}
          currentStore={currentStore}
          transfers={pendingTransfers}
        />
      )}

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from shop?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove
              {productToRemove && <span className="font-semibold"> {productToRemove.name} </span>}
              from <span className="font-semibold">{currentStore}</span>?
              {productToRemove && productToRemove.storeStock > 0 ? (
                <span className="block mt-2 text-amber-600 font-medium">
                  Notice: There are {productToRemove.storeStock} units in stock. This will create a request to return these units to the warehouse and remove the product from this shop.
                </span>
              ) : (
                <span className="block mt-2 text-slate-500">
                  This product has no stock and will be removed from the shop immediately.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromShop}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {productToRemove && productToRemove.storeStock > 0 ? 'Request Removal' : 'Remove Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
