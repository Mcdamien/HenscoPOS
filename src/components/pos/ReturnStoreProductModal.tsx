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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Return to Warehouse
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="return-product-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Product Info - Read Only */}
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-slate-500" />
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Item ID:</span>
                  <span className="ml-2 font-medium">#{product.itemId}</span>
                </div>
                <div>
                  <span className="text-slate-500">Current Store Stock:</span>
                  <span className="ml-2 font-medium">{currentStoreStock} units</span>
                </div>
              </div>
            </div>

            {/* Store Info */}
            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-700">{currentStore}</span>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">
                {product.warehouseStock} in Warehouse
              </Badge>
            </div>

            {/* Return Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">
                <strong>Return Process:</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1">
                This will create a return request that requires warehouse approval. 
                Once approved, {returnQty || 0} units will be removed from <strong>{currentStore}</strong> stock 
                and added back to the warehouse.
              </p>
            </div>

            {/* Quantity - Active Field */}
            <div>
              <Label htmlFor="qty">Quantity to Return</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                max={currentStoreStock}
                placeholder="Enter quantity to return"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={handleIntegerKeyDown}
                autoFocus
              />
              {qty && returnQty > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-slate-500">
                    New Store Stock: <span className="font-medium text-red-600">{newStoreStock} units</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    New Warehouse Stock: <span className="font-medium text-emerald-600">{newWarehouseStock} units</span>
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="return-product-form"
            disabled={submitting || returnQty <= 0 || returnQty > currentStoreStock}
          >
            {submitting ? 'Processing...' : 'Confirm Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

