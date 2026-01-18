'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Building2, Package, Calculator } from 'lucide-react'
import { handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { dexieDb } from '@/lib/dexie'

interface Product {
  id: string
  name: string
  itemId: number
  currentStock: number
  cost: number
  price: number
}

interface RestockModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  onConfirm: (productId: string, quantity: number, storeId: string) => void
}

// Field refs for keyboard navigation
// 0: Store select
// 1: Quantity input
// 2: Cancel button
// 3: Confirm button
const FIELD_COUNT = 4

interface Store {
  id: string
  name: string
}

export default function RestockModal({ isOpen, onClose, product, onConfirm }: RestockModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [allStores, setAllStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('Warehouse')
  const [storeStock, setStoreStock] = useState<number | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)
  
  // Refs for keyboard navigation
  const storeSelectRef = useRef<HTMLButtonElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch stores
  useEffect(() => {
    if (isOpen) {
      const fetchStores = async () => {
        try {
          const storesData = await dexieDb.stores.toArray()
          setAllStores(storesData)
        } catch (err) {
          console.error('Failed to fetch stores:', err)
        }
      }
      fetchStores()
    }
  }, [isOpen])

  // Fetch stock for selected store
  useEffect(() => {
    if (isOpen && product && selectedStoreId) {
      if (selectedStoreId === 'Warehouse') {
        setStoreStock(product.currentStock)
        return
      }

      const fetchStock = async () => {
        setLoadingStock(true)
        try {
          const inventory = await dexieDb.inventories
            .where('[storeId+productId]')
            .equals([selectedStoreId, product.id])
            .first()
          setStoreStock(inventory ? inventory.stock : 0)
        } catch (err) {
          console.error('Failed to fetch store stock:', err)
        } finally {
          setLoadingStock(false)
        }
      }
      fetchStock()
    }
  }, [isOpen, product, selectedStoreId])

  // Memoized handleConfirm function
  const handleConfirm = useCallback(() => {
    if (product && selectedStoreId) {
      onConfirm(product.id, quantity, selectedStoreId)
      setQuantity(1)
      onClose()
    }
  }, [product, quantity, selectedStoreId, onConfirm, onClose])

  // Keyboard navigation hook
  const { focusField, handleKeyDown, registerField } = useKeyboardNavigation({
    fieldCount: FIELD_COUNT,
    onEnterSubmit: handleConfirm
  })

  // Handle keyboard navigation for quantity input
  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 1)
    handleIntegerKeyDown(e)
  }, [handleKeyDown])

  // Focus target store select when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setTimeout(() => focusField(0), 100)
    }
  }, [isOpen, product, focusField])

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Restock Product
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</p>
            <p className="font-bold text-slate-900">{product.name}</p>
            <p className="text-xs text-slate-500 font-mono">ITEM ID: #{product.itemId}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetStore" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Target Store
            </Label>
            <Select 
              value={selectedStoreId} 
              onValueChange={setSelectedStoreId}
            >
              <SelectTrigger 
                ref={registerField(0)}
                id="targetStore"
                onKeyDown={(e) => handleKeyDown(e, 0)}
                className="w-full"
              >
                <SelectValue placeholder="Select target store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Warehouse">Warehouse</SelectItem>
                {allStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Stock at {selectedStoreId === 'Warehouse' ? 'Warehouse' : allStores.find(s => s.id === selectedStoreId)?.name || 'Store'}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {loadingStock ? '...' : `${storeStock ?? product.currentStock} units`}
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">New Stock Level</p>
              <p className="text-lg font-bold text-emerald-700">
                {loadingStock ? '...' : `${(storeStock ?? product.currentStock) + quantity} units`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Restock Quantity</Label>
            <Input
              ref={registerField(1)}
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              onKeyDown={handleQuantityKeyDown}
              className="h-11 font-bold text-lg"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Cost Estimate</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              ₵{(product.cost * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0 gap-3">
          <Button
            ref={registerField(2)}
            variant="outline"
            onClick={onClose}
            onKeyDown={(e) => handleKeyDown(e, 2)}
            className="flex-1 h-11"
          >
            Cancel
          </Button>
          <Button
            ref={registerField(3)}
            onClick={handleConfirm}
            onKeyDown={(e) => handleKeyDown(e, 3)}
            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700"
          >
            Confirm Restock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
