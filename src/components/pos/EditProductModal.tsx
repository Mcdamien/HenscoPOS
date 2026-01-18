'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Package } from 'lucide-react'
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
import { handleNumberKeyDown, handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
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

interface EditProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product | null
}

// Field refs for keyboard navigation
// 0: Cost input
// 1: Price input
// 2: Add Qty input
// 3: Cancel button
// 4: Save button
const FIELD_COUNT = 5

export default function EditProductModal({ isOpen, onClose, onSuccess, product }: EditProductModalProps) {
  const [formData, setFormData] = useState({
    cost: '',
    price: '',
    addQty: ''
  })
  const [submitting, setSubmitting] = useState(false)
  
  // Refs for keyboard navigation
  const costInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const addQtyInputRef = useRef<HTMLInputElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // Initialize form data when product changes
  useEffect(() => {
    if (product) {
      setFormData({
        cost: String(product.cost),
        price: String(product.price),
        addQty: ''
      })
    }
  }, [product])

  const { isOnline, sync } = useSync()

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!product) return

    setSubmitting(true)

    try {
      const restockData = {
        productId: product.id,
        cost: parseFloat(formData.cost),
        price: parseFloat(formData.price),
        qty: parseInt(formData.addQty) || 0
      }

      // 1. Update locally in Dexie
      await dexieDb.transaction('rw', dexieDb.products, dexieDb.syncQueue, async () => {
        await dexieDb.products.update(product.id, {
          cost: restockData.cost,
          price: restockData.price,
          warehouseStock: product.warehouseStock + restockData.qty,
          updatedAt: new Date()
        })

        // 2. Add to Sync Queue
        // NOTE: /api/products/restock is the endpoint for this
        await dexieDb.syncQueue.add({
          table: 'products',
          action: 'update',
          data: restockData,
          timestamp: Date.now()
        })
      })

      toast.success('Product updated locally!')
      onClose()
      onSuccess()

      // 3. Try to sync immediately if online
      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to update product:', error)
      toast.error('Failed to update product')
    } finally {
      setSubmitting(false)
    }
  }

  // Keyboard navigation hook
  const { registerField, handleKeyDown, focusField } = useKeyboardNavigation({
    fieldCount: FIELD_COUNT,
    onEnterSubmit: handleSubmit
  })

  const handleClose = () => {
    setFormData({ cost: '', price: '', addQty: '' })
    onClose()
  }

  // Handle keyboard navigation for inputs
  const handleCostKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 0)
    handleNumberKeyDown(e)
  }

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 1)
    handleNumberKeyDown(e)
  }

  const handleAddQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 2)
    handleIntegerKeyDown(e)
  }

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setTimeout(() => focusField(0), 100)
    }
  }, [isOpen, product, focusField])

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Package className="w-6 h-6 text-emerald-600" />
            Edit Product Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Product Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
                  <p className="text-sm font-medium text-slate-500">Item ID: #{product.itemId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Stock</span>
                  <p className="text-xl font-bold text-slate-900">{product.warehouseStock} units</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Value</span>
                  <p className="text-xl font-bold text-slate-900">GHS {(product.warehouseStock * product.cost).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cost" className="text-sm font-semibold text-slate-700">Cost Price (GHS)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₵</span>
                  <Input
                    ref={registerField(0)}
                    id="cost"
                    type="number"
                    step="0.01"
                    className="h-12 pl-8 text-lg font-medium border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    onKeyDown={handleCostKeyDown}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-semibold text-slate-700">Selling Price (GHS)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₵</span>
                  <Input
                    ref={registerField(1)}
                    id="price"
                    type="number"
                    step="0.01"
                    className="h-12 pl-8 text-lg font-medium border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    onKeyDown={handlePriceKeyDown}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
              <div className="flex items-center justify-between">
                <Label htmlFor="addQty" className="text-sm font-bold text-emerald-900">Add Stock Inventory</Label>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Optional</Badge>
              </div>
              <Input
                ref={registerField(2)}
                id="addQty"
                type="number"
                min="0"
                placeholder="Enter quantity to add"
                className="h-12 text-lg font-medium border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                value={formData.addQty}
                onChange={(e) => setFormData({ ...formData, addQty: e.target.value })}
                onKeyDown={handleAddQtyKeyDown}
              />
              {formData.addQty && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium text-emerald-700">
                    Projected New Stock:
                  </p>
                  <p className="text-sm font-bold text-emerald-900">
                    {product.warehouseStock + (parseInt(formData.addQty) || 0)} units
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button 
            ref={registerField(3)}
            type="button" 
            variant="outline" 
            className="h-12 px-8 font-semibold border-slate-300 hover:bg-slate-100 rounded-xl transition-all"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(2) // Move to addQty input
              } else if (e.key === 'Enter') {
                handleClose()
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            ref={registerField(4)}
            type="submit" 
            form="edit-product-form"
            className="h-12 px-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl transition-all active:scale-95"
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(3) // Move to cancel button
              }
            }}
          >
            {submitting ? 'Saving...' : 'Update Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

