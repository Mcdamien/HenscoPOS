'use client'

import { useState, useEffect } from 'react'
import { X, Package, Store } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { handleIntegerKeyDown, handleNumberKeyDown, cn } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { dexieDb } from '@/lib/dexie'
import { useSync } from '@/components/providers/SyncProvider'
import { v4 as uuidv4 } from 'uuid'

interface Product {
  id: string
  itemId: number
  name: string
  cost: number
  price: number
  warehouseStock: number
}

interface StoreInventory {
  storeId: string
  storeName: string
  stock: number
}

interface EditStoreProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product | null
  storeInventory: StoreInventory | null
  currentStoreId: string
}

export default function EditStoreProductModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  product, 
  storeInventory,
  currentStoreId 
}: EditStoreProductModalProps) {
  const isMobile = useIsMobile()
  const [formData, setFormData] = useState({
    changeType: 'add',
    qty: '',
    newCost: '',
    newPrice: '',
    reason: ''
  })
  const [submitting, setSubmitting] = useState(false)

  // Keyboard navigation hook
  const { registerField, handleKeyDown, focusField } = useKeyboardNavigation({
    fieldCount: 7,
    onEnterSubmit: () => {} // Handled by form submit
  })

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setFormData({
        changeType: 'add',
        qty: '',
        newCost: String(product.cost),
        newPrice: String(product.price),
        reason: ''
      })
    }
  }, [product])

  const { isOnline, sync } = useSync()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!product || !storeInventory) return

    const qty = parseInt(formData.qty) || 0
    
    // Validate
    if (formData.changeType !== 'adjust' && qty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    setSubmitting(true)

    try {
      const changeData = {
        productId: product.id,
        storeId: currentStoreId,
        changeType: formData.changeType,
        qty: qty,
        newCost: formData.newCost ? parseFloat(formData.newCost) : null,
        newPrice: formData.newPrice ? parseFloat(formData.newPrice) : null,
        reason: formData.reason,
        requestedBy: 'Store User'
      }

      // 1. Save locally to Dexie
      const newChangeId = uuidv4()
      await dexieDb.transaction('rw', dexieDb.pendingChanges, dexieDb.syncQueue, async () => {
        await dexieDb.pendingChanges.add({
          id: newChangeId,
          productId: changeData.productId,
          storeId: changeData.storeId,
          changeType: changeData.changeType,
          qty: changeData.qty,
          newCost: changeData.newCost,
          newPrice: changeData.newPrice,
          reason: changeData.reason,
          status: 'pending',
          requestedBy: changeData.requestedBy,
          createdAt: new Date(),
          updatedAt: new Date()
        })

        // 2. Add to Sync Queue
        await dexieDb.syncQueue.add({
          table: 'pendingChanges',
          action: 'create',
          data: changeData,
          timestamp: Date.now()
        })
      })

      toast.success('Inventory change request saved locally!')
      onClose()
      onSuccess()

      // 3. Try to sync immediately if online
      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to save inventory change request:', error)
      toast.error('Failed to save inventory change request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      changeType: 'add',
      qty: '',
      newCost: '',
      newPrice: '',
      reason: ''
    })
    onClose()
  }

  // Focus qty field when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setTimeout(() => focusField(1), 100)
    }
  }, [isOpen, product, focusField])

  if (!product || !storeInventory) return null

  const currentStock = storeInventory.stock
  const warehouseStock = product.warehouseStock

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-2xl flex flex-col p-0 overflow-hidden",
        isMobile ? "w-full h-full max-h-screen rounded-none" : "h-[85vh]"
      )}>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Store className="w-6 h-6 text-emerald-600" />
            Request Inventory Change
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form id="edit-store-product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Context Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">Product Info</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate">{product.name}</h3>
                <p className="text-xs font-medium text-slate-500">ID: #{product.itemId}</p>
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Warehouse</span>
                  <span className="text-sm font-bold text-slate-900">{warehouseStock} units</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">Store Context</span>
                </div>
                <h3 className="text-base font-bold text-emerald-900 truncate">{storeInventory.storeName}</h3>
                <p className="text-xs font-medium text-emerald-600">Active Session</p>
                <div className="mt-2 pt-2 border-t border-emerald-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-emerald-400 uppercase">Local Stock</span>
                  <span className="text-sm font-bold text-emerald-900">{currentStock} units</span>
                </div>
              </div>
            </div>

            {/* Change Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-700">Action Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {['add', 'remove', 'adjust'].map((type, idx) => (
                  <Button
                    key={type}
                    type="button"
                    variant={formData.changeType === type ? 'default' : 'outline'}
                    className={cn(
                      "h-11 md:h-12 capitalize font-bold rounded-xl transition-all text-xs md:text-sm",
                      formData.changeType === type 
                        ? (type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'remove' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-800 hover:bg-slate-900')
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
                    onClick={() => setFormData({ ...formData, changeType: type })}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Quantity and Metrics */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qty" className="text-sm font-bold text-slate-700">
                  {formData.changeType === 'add' && 'Quantity to Request'}
                  {formData.changeType === 'remove' && 'Quantity to Return'}
                  {formData.changeType === 'adjust' && 'New Stock Level Target'}
                </Label>
                <Input
                  ref={registerField(1)}
                  id="qty"
                  type="number"
                  min="0"
                  placeholder="Enter quantity"
                  className="h-12 md:h-14 text-lg md:text-xl font-bold border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  onKeyDown={(e) => {
                    handleKeyDown(e, 1)
                    handleIntegerKeyDown(e)
                  }}
                  required={formData.changeType !== 'adjust'}
                />
              </div>

              {formData.qty && (
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      formData.changeType === 'add' ? "bg-emerald-500" : "bg-orange-500"
                    )} />
                    <span className="text-xs md:text-sm font-medium text-slate-600">Expected Final Stock</span>
                  </div>
                  <span className="text-base md:text-lg font-black text-slate-900">
                    {formData.changeType === 'adjust' 
                      ? formData.qty 
                      : formData.changeType === 'add'
                      ? currentStock + (parseInt(formData.qty) || 0)
                      : currentStock - (parseInt(formData.qty) || 0)
                    } units
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Adjustments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="newCost" className="text-xs md:text-sm font-bold text-slate-500">New Cost (Optional)</Label>
                <Input
                  ref={registerField(2)}
                  id="newCost"
                  type="number"
                  step="0.01"
                  placeholder={`Current: ${product.cost}`}
                  className="h-11 md:h-12 border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                  value={formData.newCost}
                  onChange={(e) => setFormData({ ...formData, newCost: e.target.value })}
                  onKeyDown={(e) => {
                    handleKeyDown(e, 2)
                    handleNumberKeyDown(e)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPrice" className="text-xs md:text-sm font-bold text-slate-500">New Price (Optional)</Label>
                <Input
                  ref={registerField(3)}
                  id="newPrice"
                  type="number"
                  step="0.01"
                  placeholder={`Current: ${product.price}`}
                  className="h-11 md:h-12 border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                  value={formData.newPrice}
                  onChange={(e) => setFormData({ ...formData, newPrice: e.target.value })}
                  onKeyDown={(e) => {
                    handleKeyDown(e, 3)
                    handleNumberKeyDown(e)
                  }}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-bold text-slate-700">Reason for Change</Label>
              <Input
                ref={registerField(4)}
                id="reason"
                placeholder="e.g., Damaged goods, stock count correction"
                className="h-11 md:h-12 border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 4)}
              />
            </div>

            {/* Approval Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 md:p-4 flex gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-100 rounded-xl flex-shrink-0 flex items-center justify-center">
                <span className="text-amber-700 font-bold">!</span>
              </div>
              <div>
                <p className="text-xs md:text-sm font-bold text-amber-900">Approval Required</p>
                <p className="text-[10px] md:text-xs text-amber-700 leading-relaxed mt-0.5">
                  This request will be sent to the Warehouse Manager. Inventory will not be updated until approved.
                </p>
              </div>
            </div>
          </form>
        </div>

        <DialogFooter className={cn(
          "px-6 py-4 border-t flex flex-row justify-end gap-3 bg-slate-50 flex-shrink-0",
          isMobile && "grid grid-cols-2 gap-2"
        )}>
          <Button 
            ref={registerField(5)}
            type="button" 
            variant="outline" 
            className={cn(
              "h-11 md:h-12 px-6 md:px-8 font-semibold border-slate-300 rounded-xl transition-all hover:bg-slate-100",
              isMobile && "w-full px-0"
            )}
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(4)
              } else if (e.key === 'Enter') {
                handleClose()
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            ref={registerField(6)}
            type="submit" 
            form="edit-store-product-form"
            className={cn(
              "h-11 md:h-12 px-8 md:px-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl transition-all active:scale-95",
              isMobile && "w-full px-0"
            )}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(5)
              }
            }}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

