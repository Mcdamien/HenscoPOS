'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { handleNumberKeyDown, handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!product) return

    setSubmitting(true)

    try {
      const response = await fetch('/api/products/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          cost: parseFloat(formData.cost),
          price: parseFloat(formData.price),
          qty: parseInt(formData.addQty) || 0
        })
      })

      if (response.ok) {
        toast.success('Product updated successfully!')
        onClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || error.message || 'Failed to update product')
      }
    } catch (error) {
      console.error('Failed to update product:', error)
      toast.error('Failed to update product')
    } finally {
      setSubmitting(false)
    }
  }

  // Keyboard navigation hook
  const { focusField, handleKeyDown } = useKeyboardNavigation({
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
      setTimeout(() => costInputRef.current?.focus(), 100)
    }
  }, [isOpen, product])

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Edit Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Info - Read Only */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Item ID:</span>
                <span className="ml-2 font-medium">#{product.itemId}</span>
              </div>
              <div>
                <span className="text-slate-500">Product:</span>
                <span className="ml-2 font-medium">{product.name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Current Stock:</span>
                <span className="ml-2 font-medium">{product.warehouseStock} units</span>
              </div>
            </div>
          </div>

          {/* Price Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost">Cost (GHS)</Label>
              <Input
                ref={costInputRef}
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                onKeyDown={handleCostKeyDown}
                required
              />
            </div>
            <div>
              <Label htmlFor="price">Price (GHS)</Label>
              <Input
                ref={priceInputRef}
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                onKeyDown={handlePriceKeyDown}
                required
              />
            </div>
          </div>

          {/* Add Stock Quantity */}
          <div>
            <Label htmlFor="addQty">Add to Stock</Label>
            <Input
              ref={addQtyInputRef}
              id="addQty"
              type="number"
              min="0"
              placeholder="Enter quantity to add"
              value={formData.addQty}
              onChange={(e) => setFormData({ ...formData, addQty: e.target.value })}
              onKeyDown={handleAddQtyKeyDown}
            />
            {formData.addQty && (
              <p className="text-xs text-slate-500 mt-1">
                New Stock: {product.warehouseStock + (parseInt(formData.addQty) || 0)} units
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              ref={cancelButtonRef}
              type="button" 
              variant="outline" 
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
              ref={saveButtonRef}
              type="submit" 
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && e.shiftKey) {
                  e.preventDefault()
                  focusField(3) // Move to cancel button
                }
              }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

