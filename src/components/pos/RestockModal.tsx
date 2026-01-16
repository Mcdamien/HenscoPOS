'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Building2 } from 'lucide-react'
import { handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  onConfirm: (productId: string, quantity: number, storeName?: string) => void
}

// Field refs for keyboard navigation
// 0: Store select
// 1: Quantity input
// 2: Cancel button
// 3: Confirm button
const FIELD_COUNT = 4

export default function RestockModal({ isOpen, onClose, product, onConfirm }: RestockModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [stores, setStores] = useState<string[]>([])
  const [selectedStore, setSelectedStore] = useState<string>('Warehouse')
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
      fetch('/api/stores')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setStores(['Warehouse', ...data])
          }
        })
        .catch(err => console.error('Failed to fetch stores:', err))
    }
  }, [isOpen])

  // Fetch stock for selected store
  useEffect(() => {
    if (isOpen && product && selectedStore) {
      if (selectedStore === 'Warehouse') {
        setStoreStock(product.currentStock)
        return
      }

      setLoadingStock(true)
      fetch(`/api/inventory?store=${encodeURIComponent(selectedStore)}`)
        .then(res => res.json())
        .then(data => {
          const productInfo = data.find((p: any) => p.id === product.id)
          if (productInfo) {
            setStoreStock(productInfo.storeStock)
          } else {
            setStoreStock(0)
          }
        })
        .catch(err => console.error('Failed to fetch store stock:', err))
        .finally(() => setLoadingStock(false))
    }
  }, [isOpen, product, selectedStore])

  // Memoized handleConfirm function
  const handleConfirm = useCallback(() => {
    if (product) {
      onConfirm(product.id, quantity, selectedStore)
      setQuantity(1)
      onClose()
    }
  }, [product, quantity, selectedStore, onConfirm, onClose])

  // Keyboard navigation hook
  const { focusField, handleKeyDown } = useKeyboardNavigation({
    fieldCount: FIELD_COUNT,
    onEnterSubmit: handleConfirm
  })

  // Handle keyboard navigation for quantity input
  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 1)
    handleIntegerKeyDown(e)
  }, [handleKeyDown])

  // Focus quantity input when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setTimeout(() => storeSelectRef.current?.focus(), 100)
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Restock Product</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600">Product</p>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-gray-500">Item ID: {product.itemId}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Target Store
            </label>
            <Select 
              value={selectedStore} 
              onValueChange={setSelectedStore}
            >
              <SelectTrigger 
                ref={storeSelectRef}
                onKeyDown={(e) => handleKeyDown(e, 0)}
                className="w-full"
              >
                <SelectValue placeholder="Select target store" />
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

          <div className="mb-4">
            <p className="text-sm text-gray-600">Current Stock at {selectedStore}</p>
            <p className="font-medium">
              {loadingStock ? 'Loading...' : `${storeStock ?? product.currentStock} units`}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">
              Restock Quantity
            </label>
            <input
              ref={quantityInputRef}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              onKeyDown={handleQuantityKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">New Stock Level at {selectedStore}</p>
            <p className="text-2xl font-bold text-emerald-600">
              {loadingStock ? '...' : `${(storeStock ?? product.currentStock) + quantity} units`}
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">Cost Estimate</p>
            <p className="font-medium">
              ₵{(product.cost * quantity).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(1) // Move to quantity input
              } else if (e.key === 'Enter') {
                onClose()
              }
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(2) // Move to cancel button
              }
            }}
          >
            Confirm Restock
          </button>
        </div>
      </div>
    </div>
  )
}

