'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Truck, Search, Check, Plus, Trash2, Send, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

interface Product {
  id: string
  itemId: number
  name: string
  warehouseStock: number
}

interface TransferItem {
  productId: string
  name: string
  qty: number
  warehouseStock: number
}

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  stores: string[]
  currentStore: string
  products: Product[]
  onSuccess: () => void
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Field refs for keyboard navigation
// 0: Product search input
// 1: Qty input
// 2: Add More button
// 3: Done button
// 4: Cancel button
const FIELD_COUNT = 5

export default function TransferModal({ isOpen, onClose, stores, currentStore, products, onSuccess }: TransferModalProps) {
  const [formData, setFormData] = useState({
    productId: '',
    targetStore: currentStore || '',
    qty: ''
  })
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Refs for keyboard navigation
  const searchRef = useRef<HTMLDivElement>(null)

  // Debounce search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 200)

  // Filter products based on debounced search term
  const filteredProducts = useMemo(() => {
    if (!debouncedSearchTerm) return products
    const query = debouncedSearchTerm.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      String(p.itemId).includes(query)
    )
  }, [products, debouncedSearchTerm])

  const availableStores = stores.filter(s => s !== currentStore)
  const selectedProduct = products.find(p => p.id === formData.productId)

  const removeItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (transferItems.length === 0) {
      toast.error('Please add at least one item to transfer')
      return
    }
    if (!formData.targetStore) {
      toast.error('Please select a destination shop')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: transferItems.map(item => ({
            productId: item.productId,
            qty: item.qty
          })),
          targetStore: formData.targetStore
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Transfer #${data.transferId} completed successfully!`)
        handleClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Transfer failed')
      }
    } catch (error) {
      console.error('Transfer failed:', error)
      toast.error('Transfer failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Keyboard navigation hook
  const { focusField, handleKeyDown, registerField } = useKeyboardNavigation({
    fieldCount: FIELD_COUNT,
    onEnterSubmit: handleSubmit
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddItem = () => {
    if (!formData.productId || !formData.qty || !selectedProduct) {
      toast.error('Please select a product and quantity')
      return
    }

    const qty = parseInt(formData.qty)
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    if (qty > selectedProduct.warehouseStock) {
      toast.error('Insufficient warehouse stock')
      return
    }

    // Check if already in list
    const existingIndex = transferItems.findIndex(item => item.productId === formData.productId)
    if (existingIndex > -1) {
      const newItems = [...transferItems]
      const totalQty = newItems[existingIndex].qty + qty
      if (totalQty > selectedProduct.warehouseStock) {
        toast.error(`Total quantity (${totalQty}) exceeds available stock (${selectedProduct.warehouseStock})`)
        return
      }
      newItems[existingIndex].qty = totalQty
      setTransferItems(newItems)
    } else {
      setTransferItems([
        ...transferItems,
        {
          productId: formData.productId,
          name: selectedProduct.name,
          qty: qty,
          warehouseStock: selectedProduct.warehouseStock
        }
      ])
    }

    // Reset item fields but keep targetStore
    setFormData({ ...formData, productId: '', qty: '' })
    setSearchTerm('')
    toast.success('Item added to transfer list')

    // Move focus back to product search
    setTimeout(() => focusField(0), 0)
  }

  const handleClose = () => {
    setFormData({ productId: '', targetStore: currentStore || '', qty: '' })
    setTransferItems([])
    setSearchTerm('')
    onClose()
  }

  const handleProductSelect = (product: Product) => {
    setFormData({ ...formData, productId: product.id })
    setSearchTerm(product.name)
    setIsSearchOpen(false)
    // Move focus to qty input
    setTimeout(() => focusField(1), 0)
  }

  const clearProductSelection = () => {
    setFormData({ ...formData, productId: '' })
    setSearchTerm('')
  }

  // Handle keyboard navigation for inputs
  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      focusField(1) // Move to qty input
    } else {
      handleKeyDown(e, 0)
    }
  }

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddItem()
    } else {
      handleKeyDown(e, 1)
      handleIntegerKeyDown(e)
    }
  }

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => focusField(0), 100)
    }
  }, [isOpen, focusField])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Stock Transfer System
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-0 pb-6 space-y-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-3 h-3" />
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Destination:</span>
              <span className="text-sm font-semibold text-slate-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {formData.targetStore}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="product">Product</Label>
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    ref={registerField(0)}
                    id="product"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setIsSearchOpen(true)
                    }}
                    onKeyDown={handleProductSearchKeyDown}
                    className="pl-10"
                  />
                  {formData.productId && (
                    <button
                      type="button"
                      onClick={clearProductSelection}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {isSearchOpen && searchTerm && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">No matches</div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductSelect(product)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 flex items-center justify-between ${
                            formData.productId === product.id ? 'bg-slate-50' : ''
                          }`}
                        >
                          <span>{product.name} <span className="text-slate-400">({product.warehouseStock})</span></span>
                          {formData.productId === product.id && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="qty">Qty</Label>
                <Input
                  ref={registerField(1)}
                  id="qty"
                  type="number"
                  min="1"
                  max={selectedProduct?.warehouseStock}
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  onKeyDown={handleQtyKeyDown}
                />
              </div>
              <Button 
                ref={registerField(2)}
                type="button" 
                variant="secondary" 
                onClick={handleAddItem}
                disabled={!formData.productId || !formData.qty}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault()
                    focusField(3) // Move to done button
                  } else if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault()
                    focusField(0) // Move to product search
                  } else if (e.key === 'Enter') {
                    handleAddItem()
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add More
              </Button>
            </div>
          </div>

          {transferItems.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center w-24">Qty</TableHead>
                    <TableHead className="text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="py-2">{item.name}</TableCell>
                      <TableCell className="text-center py-2">{item.qty}</TableCell>
                      <TableCell className="text-right py-2">
                        <button 
                          onClick={() => removeItem(index)} 
                          className="text-red-500 hover:text-red-700"
                          tabIndex={-1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button 
              ref={registerField(4)}
              type="button" 
              variant="outline" 
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                  e.preventDefault()
                  focusField(0) // Back to product search
                } else if (e.key === 'Tab' && e.shiftKey) {
                  e.preventDefault()
                  focusField(3) // Back to done button
                } else if (e.key === 'Enter') {
                  handleClose()
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              ref={registerField(3)}
              onClick={handleSubmit}
              disabled={submitting || transferItems.length === 0 || !formData.targetStore}
              className="bg-emerald-600 hover:bg-emerald-700"
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                  e.preventDefault()
                  focusField(4) // Move to cancel button
                } else if (e.key === 'Tab' && e.shiftKey) {
                  e.preventDefault()
                  focusField(2) // Move to add more button
                }
              }}
            >
              {submitting ? 'Processing...' : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Done
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

