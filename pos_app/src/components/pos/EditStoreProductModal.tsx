'use client'

import { useState, useEffect } from 'react'
import { X, Package, Store } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { handleIntegerKeyDown, handleNumberKeyDown } from '@/lib/utils'

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
  const [formData, setFormData] = useState({
    changeType: 'add',
    qty: '',
    newCost: '',
    newPrice: '',
    reason: ''
  })
  const [submitting, setSubmitting] = useState(false)

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
      const response = await fetch('/api/inventory/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          storeId: currentStoreId,
          changeType: formData.changeType,
          qty: qty,
          newCost: formData.newCost ? parseFloat(formData.newCost) : null,
          newPrice: formData.newPrice ? parseFloat(formData.newPrice) : null,
          reason: formData.reason,
          requestedBy: 'Store User'
        })
      })

      if (response.ok) {
        toast.success('Inventory change request submitted for approval!')
        onClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || error.message || 'Failed to submit request')
      }
    } catch (error) {
      console.error('Failed to submit inventory change request:', error)
      toast.error('Failed to submit inventory change request')
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

  if (!product || !storeInventory) return null

  const currentStock = storeInventory.stock
  const warehouseStock = product.warehouseStock

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Request Inventory Change
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                <span className="text-slate-500">Current Stock:</span>
                <span className="ml-2 font-medium">{currentStock} units</span>
              </div>
            </div>
          </div>

          {/* Store Info */}
          <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-700">{storeInventory.storeName}</span>
            </div>
            <Badge variant="outline" className="bg-blue-100 text-blue-700">
              {warehouseStock} in Warehouse
            </Badge>
          </div>

          {/* Change Type */}
          <div>
            <Label>Change Type</Label>
            <div className="flex gap-2 mt-2">
              {['add', 'remove', 'adjust'].map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={formData.changeType === type ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 capitalize"
                  onClick={() => setFormData({ ...formData, changeType: type })}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <Label htmlFor="qty">
              {formData.changeType === 'add' && 'Quantity to Add (from Warehouse)'}
              {formData.changeType === 'remove' && 'Quantity to Remove'}
              {formData.changeType === 'adjust' && 'New Stock Level'}
            </Label>
            <Input
              id="qty"
              type="number"
              min="0"
              placeholder="Enter quantity"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              onKeyDown={handleIntegerKeyDown}
              required={formData.changeType !== 'adjust'}
            />
            {formData.qty && (
              <p className="text-xs text-slate-500 mt-1">
                New Stock: {
                  formData.changeType === 'adjust' 
                    ? formData.qty 
                    : formData.changeType === 'add'
                    ? currentStock + (parseInt(formData.qty) || 0)
                    : currentStock - (parseInt(formData.qty) || 0)
                } units
              </p>
            )}
          </div>

          {/* Price Fields - Optional */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newCost">New Cost (Optional)</Label>
              <Input
                id="newCost"
                type="number"
                step="0.01"
                placeholder="Keep current"
                value={formData.newCost}
                onChange={(e) => setFormData({ ...formData, newCost: e.target.value })}
                onKeyDown={handleNumberKeyDown}
              />
            </div>
            <div>
              <Label htmlFor="newPrice">New Price (Optional)</Label>
              <Input
                id="newPrice"
                type="number"
                step="0.01"
                placeholder="Keep current"
                value={formData.newPrice}
                onChange={(e) => setFormData({ ...formData, newPrice: e.target.value })}
                onKeyDown={handleNumberKeyDown}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Reason for Change</Label>
            <Input
              id="reason"
              placeholder="e.g., Stock count correction, price update"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          {/* Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> This change requires warehouse approval before it will be applied to your store inventory.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

