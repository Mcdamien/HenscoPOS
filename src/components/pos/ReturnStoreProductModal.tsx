'use client'

import { useState, useEffect } from 'react'
import { X, Package, Store, RotateCcw } from 'lucide-react'
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
import { handleIntegerKeyDown } from '@/lib/utils'

interface Product {
  id: string
  itemId: number
  name: string
  price: number
  warehouseStock: number
}

interface ReturnStoreProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product | null
  currentStore: string
  currentStoreStock: number
}

export default function ReturnStoreProductModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  product,
  currentStore,
  currentStoreStock
}: ReturnStoreProductModalProps) {
  const [qty, setQty] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset qty when modal opens
  useEffect(() => {
    if (isOpen) {
      setQty('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!product) return

    const returnQty = parseInt(qty) || 0
    
    // Validate
    if (returnQty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    if (returnQty > currentStoreStock) {
      toast.error(`Cannot return more than available stock (${currentStoreStock} units)`)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/inventory/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          storeId: currentStore,
          qty: returnQty,
          returnedBy: 'Store User'
        })
      })

      if (response.ok) {
        toast.success(`Return request submitted for warehouse approval!`)
        onClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || error.message || 'Failed to submit return request')
      }
    } catch (error) {
      console.error('Failed to process return:', error)
      toast.error('Failed to process return')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setQty('')
    onClose()
  }

  if (!product) return null

  const returnQty = parseInt(qty) || 0
  const newStoreStock = currentStoreStock - returnQty
  const newWarehouseStock = product.warehouseStock + returnQty

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RotateCcw className="w-6 h-6 text-amber-600" />
            Return to Warehouse
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <form id="return-product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Product Info - Read Only */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 leading-tight">{product.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Item ID: #{product.itemId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Store Stock</p>
                  <p className="font-bold text-slate-700">{currentStoreStock} units</p>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Warehouse</p>
                  <p className="font-bold text-blue-700">{product.warehouseStock} units</p>
                </div>
              </div>
            </div>

            {/* Store Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-slate-700">{currentStore}</span>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                CURRENT STORE
              </Badge>
            </div>

            {/* Return Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <RotateCcw className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">Return Process Notice</p>
                <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                  This will create a return request that requires warehouse approval. 
                  Once approved, units will be moved from <strong>{currentStore}</strong> back to the main warehouse.
                </p>
              </div>
            </div>

            {/* Quantity - Active Field */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qty" className="text-sm font-bold text-slate-700">Quantity to Return</Label>
                <div className="relative">
                  <Input
                    id="qty"
                    type="number"
                    min="1"
                    max={currentStoreStock}
                    placeholder="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onKeyDown={handleIntegerKeyDown}
                    autoFocus
                    className="h-14 text-2xl font-black text-slate-900 pl-4 border-2 focus-visible:ring-emerald-500 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    UNITS
                  </div>
                </div>
              </div>
              
              {qty && returnQty > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Final Store</p>
                    <p className="text-lg font-black text-red-600">{newStoreStock}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Final WH</p>
                    <p className="text-lg font-black text-emerald-600">{newWarehouseStock}</p>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex gap-3 w-full">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 font-bold">
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="return-product-form"
              disabled={submitting || returnQty <= 0 || returnQty > currentStoreStock}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-sm"
            >
              {submitting ? 'Processing...' : 'Confirm Return'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

