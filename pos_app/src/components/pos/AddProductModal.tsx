'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Package, Check, ChevronsUpDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required')
      // Focus on product name field
      setTimeout(() => searchTriggerRef.current?.focus(), 0)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          cost: parseFloat(formData.cost),
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock)
        })
      })

      if (response.ok) {
        toast.success('Product added successfully!')
        onClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || error.message || 'Failed to add product')
      }
    } catch (error) {
      console.error('Failed to add product:', error)
      toast.error('Failed to add product')
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
      setTimeout(() => searchTriggerRef.current?.focus(), 100)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Product Name</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={searchTriggerRef}
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between font-normal"
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
                  {formData.name || "Search or enter product name..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput 
                      placeholder="Type product name..." 
                      value={searchQuery}
                      onValueChange={(val) => setSearchQuery(val)}
                    />
                  <CommandList>
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

          <div>
            <Label htmlFor="stock">
              {existingProduct ? 'Add Quantity' : 'Initial Warehouse Stock'}
            </Label>
            <Input
              ref={stockInputRef}
              id="stock"
              type="number"
              min={existingProduct ? "1" : "0"}
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              onKeyDown={handleStockKeyDown}
              required
            />
            {existingProduct && (
              <p className="text-xs text-slate-500 mt-1">
                Current Balance: {existingProduct.warehouseStock}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              ref={cancelButtonRef}
              type="button" 
              variant="outline" 
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
              ref={saveButtonRef}
              type="submit" 
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

