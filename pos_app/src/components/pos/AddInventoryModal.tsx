'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, Check, ChevronsUpDown, Hash, Calendar, Plus, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

interface Product {
  id: string
  itemId: number
  name: string
  cost: number
  price: number
  warehouseStock: number
}

interface InventoryItem {
  id: string // Local ID for the list
  name: string
  cost: string
  price: string
  stock: string
}

interface AddInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  products: Product[]
}

// Generate a unique inventory ID
function generateInventoryId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `INV-${year}${month}-${random}`
}

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
// 0: Search/Name input
// 1: Cost input
// 2: Price input
// 3: Qty input
// 4: Add to list button
// 5: Cancel button
// 6: Done button
const FIELD_COUNT = 7

export default function AddInventoryModal({ isOpen, onClose, onSuccess, products }: AddInventoryModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [currentItem, setCurrentItem] = useState({
    name: '',
    cost: '',
    price: '',
    stock: ''
  })
  const [inventoryId, setInventoryId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  // Refs for keyboard navigation
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const costInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)
  const addMoreButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const doneButtonRef = useRef<HTMLButtonElement>(null)

  // Generate inventory ID when modal opens
  useEffect(() => {
    if (isOpen) {
      setInventoryId(generateInventoryId())
    }
  }, [isOpen])

  const debouncedSearchQuery = useDebounce(searchQuery, 200)

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery) return products
    const query = debouncedSearchQuery.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      String(p.itemId).includes(query)
    )
  }, [products, debouncedSearchQuery])

  const handleSelectProduct = (product: Product) => {
    setCurrentItem({
      name: product.name,
      cost: String(product.cost),
      price: String(product.price),
      stock: ''
    })
    setOpen(false)
    setTimeout(() => focusField(3), 0) // Focus on qty input
  }

  const handleAddMore = () => {
    if (!currentItem.name.trim()) {
      toast.error('Item name is required')
      setTimeout(() => searchTriggerRef.current?.focus(), 0)
      return
    }

    // Validate cost - must be a valid positive number
    const costNum = parseFloat(currentItem.cost)
    if (!currentItem.cost || isNaN(costNum) || costNum <= 0) {
      toast.error('Valid cost (positive number) is required')
      setTimeout(() => costInputRef.current?.focus(), 0)
      return
    }

    // Validate price - must be a valid positive number
    const priceNum = parseFloat(currentItem.price)
    if (!currentItem.price || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Valid price (positive number) is required')
      setTimeout(() => priceInputRef.current?.focus(), 0)
      return
    }

    // Validate stock - must be a valid positive integer
    const stockNum = parseInt(currentItem.stock)
    if (!currentItem.stock || isNaN(stockNum) || stockNum <= 0) {
      toast.error('Valid quantity (positive number) is required')
      setTimeout(() => stockInputRef.current?.focus(), 0)
      return
    }

    const newItem: InventoryItem = {
      ...currentItem,
      id: Math.random().toString(36).substr(2, 9)
    }

    setItems([...items, newItem])
    setCurrentItem({
      name: '',
      cost: '',
      price: '',
      stock: ''
    })
    setSearchQuery('')
    setTimeout(() => searchTriggerRef.current?.focus(), 0)
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  async function handleSubmit() {
    let finalItems = [...items]

    // If there's something in currentItem with valid stock, try to add it
    if (currentItem.name.trim() && currentItem.stock) {
      const stockNum = parseInt(currentItem.stock)
      if (!isNaN(stockNum) && stockNum > 0) {
        finalItems.push({
          ...currentItem,
          id: 'temp'
        })
      }
    }

    if (finalItems.length === 0) {
      toast.error('At least one item is required')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/inventory/addition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: finalItems,
          referenceId: inventoryId
        })
      })

      if (response.ok) {
        toast.success('Inventory added successfully!')
        handleClose()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add inventory')
      }
    } catch (error) {
      console.error('Failed to add inventory:', error)
      toast.error('Failed to add inventory')
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
    setItems([])
    setCurrentItem({ name: '', cost: '', price: '', stock: '' })
    setSearchQuery('')
    setInventoryId('')
    setOpen(false)
    onClose()
  }

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchTriggerRef.current?.focus(), 100)
    }
  }, [isOpen])

  const totalCost = items.reduce((sum, item) => sum + (parseFloat(item.cost) * parseInt(item.stock)), 0) +
    (currentItem.cost && currentItem.stock ? parseFloat(currentItem.cost) * parseInt(currentItem.stock) : 0)

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Add Inventory Batch
            </div>
            <div className="flex items-center gap-4 text-sm font-normal text-slate-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {today}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inventory-id" className="flex items-center gap-2">
                <Hash className="w-3 h-3" /> Inventory ID
              </Label>
              <Input
                id="inventory-id"
                value={inventoryId}
                readOnly
                className="bg-emerald-50 border-emerald-200 text-emerald-700 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Total Items
              </Label>
              <Input
                value={items.length + (currentItem.name ? 1 : 0)}
                disabled
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              Add Item
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      ref={searchTriggerRef}
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      onKeyDown={(e) => handleKeyDown(e, 0)} // Use `useKeyboardNavigation` for tab navigation
                    >
                      {currentItem.name || "Search or type item name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Type item name..."
                        value={searchQuery}
                        onValueChange={(val) => {
                          setSearchQuery(val)
                          setCurrentItem(prev => ({ ...prev, name: val }))
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>No existing product found. Type to add as new.</CommandEmpty>
                        <CommandGroup heading="Existing Products">
                          {filteredProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => handleSelectProduct(product)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", currentItem.name === product.name ? "opacity-100" : "opacity-0")} />
                              {product.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price</Label>
                  <Input
                    ref={costInputRef}
                    id="cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={currentItem.cost}
                    onChange={(e) => setCurrentItem({ ...currentItem, cost: e.target.value })}
                    onKeyDown={handleCostKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price</Label>
                  <Input
                    ref={priceInputRef}
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={currentItem.price}
                    onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })}
                    onKeyDown={handlePriceKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Quantity</Label>
                  <Input
                    ref={stockInputRef}
                    id="stock"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={currentItem.stock}
                    onChange={(e) => setCurrentItem({ ...currentItem, stock: e.target.value })}
                    onKeyDown={handleStockKeyDown}
                  />
                </div>
              </div>

              <Button
                ref={addMoreButtonRef}
                type="button"
                variant="outline"
                className="w-full border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={handleAddMore}
                onKeyDown={(e) => handleKeyDown(e, 4)} // Use `useKeyboardNavigation` for tab navigation
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to List
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Items in Batch ({items.length})</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="py-2 font-medium">{item.name}</TableCell>
                        <TableCell className="py-2 text-right">GHS {parseFloat(item.cost).toFixed(2)}</TableCell>
                        <TableCell className="py-2 text-right">GHS {parseFloat(item.price).toFixed(2)}</TableCell>
                        <TableCell className="py-2 text-right">{item.stock}</TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-slate-50 flex items-center justify-end">
          <div className="flex gap-3">
            <Button
              ref={cancelButtonRef}
              variant="outline"
              onClick={handleClose}
              onKeyDown={(e) => handleKeyDown(e, 5)} // Use `useKeyboardNavigation` for tab navigation
            >
              Cancel
            </Button>
            <Button
              ref={doneButtonRef}
              disabled={submitting || (items.length === 0 && !currentItem.name)}
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 min-w-[100px]"
              onKeyDown={(e) => handleKeyDown(e, 6)} // Use `useKeyboardNavigation` for tab navigation
            >
              {submitting ? 'Processing...' : 'Done'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

