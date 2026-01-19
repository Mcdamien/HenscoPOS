'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Package, Check, ChevronsUpDown } from 'lucide-react'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn, handleNumberKeyDown, handleIntegerKeyDown } from '@/lib/utils'
import { toast } from 'sonner'
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

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  products: Product[]
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
// 0: Product search/trigger
// 1: Cost input
// 2: Price input
// 3: Stock input
// 4: Cancel button
// 5: Save button
const FIELD_COUNT = 6

export default function AddProductModal({ isOpen, onClose, onSuccess, products }: AddProductModalProps) {
  const isMobile = useIsMobile()
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    price: '',
    stock: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)
  
  // Refs for keyboard navigation
  const costInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)

  // Debounce the search query to prevent excessive filtering
  const debouncedSearchQuery = useDebounce(searchQuery, 200)

  // Filter products based on debounced search query
  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery) return products
    const query = debouncedSearchQuery.toLowerCase()
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      String(p.itemId).includes(query)
    )
  }, [products, debouncedSearchQuery])

  const debouncedFormDataName = useDebounce(formData.name, 300)

  const existingProduct = useMemo(() => 
    products.find(p => p.name.toLowerCase() === debouncedFormDataName.toLowerCase()),
    [products, debouncedFormDataName]
  )

  const handleSelectProduct = (product: Product) => {
    setFormData({
      name: product.name,
      cost: String(product.cost),
      price: String(product.price),
      stock: '' // Clear the quantity textbox for existing items
    })
    setOpen(false)
    // Move focus to next field (Cost input)
    setTimeout(() => focusField(1), 0)
  }

  const { isOnline, sync } = useSync()

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required')
      // Focus on product name field
      setTimeout(() => searchTriggerRef.current?.focus(), 0)
      return
    }

    setSubmitting(true)

    try {
      const productData = {
        name: formData.name,
        cost: parseFloat(formData.cost),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0
      }

      // 1. Save locally to Dexie
      await dexieDb.transaction('rw', dexieDb.products, dexieDb.syncQueue, async () => {
        const existing = await dexieDb.products.where('name').equals(formData.name).first()
        
        if (existing) {
          await dexieDb.products.update(existing.id, {
            cost: productData.cost,
            price: productData.price,
            warehouseStock: existing.warehouseStock + productData.stock,
            updatedAt: new Date()
          })
        } else {
          await dexieDb.products.add({
            id: uuidv4(),
            itemId: 0, // Temporary ID, server will assign
            name: productData.name,
            cost: productData.cost,
            price: productData.price,
            warehouseStock: productData.stock,
            restockQty: 0,
            updatedAt: new Date()
          })
        }

        // 2. Add to Sync Queue
        await dexieDb.syncQueue.add({
          table: 'products',
          action: 'create',
          data: productData,
          timestamp: Date.now()
        })
      })

      toast.success('Product saved locally!')
      handleClose()
      onSuccess()

      // 3. Try to sync immediately if online
      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to save product:', error)
      toast.error('Failed to save product')
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
    setFormData({ name: '', cost: '', price: '', stock: '' })
    setSearchQuery('')
    setOpen(false)
    onClose()
  }

  // Handle keyboard navigation for inputs
  const handleCostKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 1)
    handleNumberKeyDown(e)
  }

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 2)
    handleNumberKeyDown(e)
  }

  const handleStockKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleKeyDown(e, 3)
    handleIntegerKeyDown(e)
  }

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => focusField(0), 100)
    }
  }, [isOpen, focusField])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-2xl flex flex-col p-0 overflow-hidden",
        isMobile ? "w-full h-full max-h-screen rounded-none" : "h-[80vh]"
      )}>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form id="add-product-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Product Name</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    ref={registerField(0)}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal h-11 text-base border-slate-300 hover:border-blue-400 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault()
                        focusField(1) // Move to cost input
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        setOpen(true)
                      }
                    }}
                  >
                    <span className="truncate">{formData.name || "Search or enter product name..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[--radix-popover-trigger-width] p-0" 
                  align="start"
                  side={isMobile ? "bottom" : "bottom"}
                  avoidCollisions={true}
                >
                  <Command>
                    <CommandInput 
                      placeholder="Type product name..." 
                      value={searchQuery}
                      onValueChange={(val) => setSearchQuery(val)}
                    />
                    <CommandList className={isMobile ? "max-h-[200px]" : "max-h-[300px]"}>
                      <CommandEmpty>No existing product found. You can continue typing to add this as a new product.</CommandEmpty>
                      <CommandGroup heading="Select Existing Product">
                        {filteredProducts.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={() => handleSelectProduct(product)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.name === product.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {product.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="cost" className="text-sm font-semibold text-slate-700">Cost (GHS)</Label>
                <Input
                  ref={registerField(1)}
                  id="cost"
                  type="number"
                  step="0.01"
                  className="h-11 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  onKeyDown={handleCostKeyDown}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-semibold text-slate-700">Price (GHS)</Label>
                <Input
                  ref={registerField(2)}
                  id="price"
                  type="number"
                  step="0.01"
                  className="h-11 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  onKeyDown={handlePriceKeyDown}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock" className="text-sm font-semibold text-slate-700">
                {existingProduct ? 'Add Quantity' : 'Initial Warehouse Stock'}
              </Label>
              <Input
                ref={registerField(3)}
                id="stock"
                type="number"
                min={existingProduct ? "1" : "0"}
                className="h-11 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                onKeyDown={handleStockKeyDown}
                placeholder="0"
                required
              />
              {existingProduct && (
                <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Current Balance: {existingProduct.warehouseStock}
                </p>
              )}
            </div>
          </form>
        </div>

        <DialogFooter className={cn(
          "px-6 py-4 border-t flex flex-row justify-end gap-3 bg-slate-50 flex-shrink-0",
          isMobile && "grid grid-cols-2 gap-2"
        )}>
          <Button 
            ref={registerField(4)}
            type="button" 
            variant="outline" 
            className={cn(
              "h-11 px-6 border-slate-300 text-slate-700 hover:bg-slate-100",
              isMobile && "w-full"
            )}
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(3) // Move to stock input
              } else if (e.key === 'Enter') {
                handleClose()
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            ref={registerField(5)}
            type="submit" 
            form="add-product-form"
            className={cn(
              "h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
              isMobile && "w-full"
            )}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                focusField(4) // Move to cancel button
              }
            }}
          >
            {submitting ? 'Adding...' : 'Save Product'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}

