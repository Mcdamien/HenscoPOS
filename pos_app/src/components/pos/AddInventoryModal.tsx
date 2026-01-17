'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, Check, ChevronsUpDown, Hash, Calendar, Plus, Trash2 } from 'lucide-react'
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
import { cn, handleNumberKeyDown, handleIntegerKeyDown, formatDateDDMMYYYY } from '@/lib/utils'
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
      setTimeout(() => focusField(0), 0)
      return
    }

    // Validate cost - must be a valid positive number
    const costNum = parseFloat(currentItem.cost)
    if (!currentItem.cost || isNaN(costNum) || costNum <= 0) {
      toast.error('Valid cost (positive number) is required')
      setTimeout(() => focusField(1), 0)
      return
    }

    // Validate price - must be a valid positive number
    const priceNum = parseFloat(currentItem.price)
    if (!currentItem.price || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Valid price (positive number) is required')
      setTimeout(() => focusField(2), 0)
      return
    }

    // Validate stock - must be a valid positive integer
    const stockNum = parseInt(currentItem.stock)
    if (!currentItem.stock || isNaN(stockNum) || stockNum <= 0) {
      toast.error('Valid quantity (positive number) is required')
      setTimeout(() => focusField(3), 0)
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
    setTimeout(() => focusField(0), 0)
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
  const { focusField, handleKeyDown, registerField } = useKeyboardNavigation({
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

  const today = formatDateDDMMYYYY(new Date())

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => focusField(0), 100)
    }
  }, [isOpen, focusField])

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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Package className="w-6 h-6 text-emerald-600" />
                Add Inventory Batch
              </DialogTitle>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Calendar className="w-3.5 h-3.5" />
                  {today}
                </span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                  REF: {inventoryId}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
            <div className="md:col-span-2 space-y-4">
              <div className="border rounded-xl p-4 bg-slate-50/50 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Add Item
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                  <div className="lg:col-span-2 space-y-2">
                    <Label htmlFor="name">Item Name</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          ref={registerField(0)}
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal bg-white"
                          onKeyDown={(e) => {
                            handleKeyDown(e, 0)
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              setOpen(true)
                            }
                          }}
                        >
                          <span className="truncate">{currentItem.name || "Search or type item name..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[--radix-popover-trigger-width] p-0" 
                        align="start"
                        onOpenAutoFocus={(e) => {
                          const input = document.querySelector('[cmdk-input]') as HTMLInputElement
                          if (input) {
                            setTimeout(() => input.focus(), 0)
                          }
                        }}
                      >
                        <Command>
                          <CommandInput
                            placeholder="Type item name..."
                            value={searchQuery}
                            onValueChange={(val) => {
                              setSearchQuery(val)
                              setCurrentItem(prev => ({ ...prev, name: val }))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && searchQuery) {
                                setOpen(false)
                                setTimeout(() => focusField(1), 0)
                              }
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

                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost Price</Label>
                    <Input
                      ref={registerField(1)}
                      id="cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={currentItem.cost}
                      onChange={(e) => setCurrentItem({ ...currentItem, cost: e.target.value })}
                      onKeyDown={handleCostKeyDown}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price</Label>
                    <Input
                      ref={registerField(2)}
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={currentItem.price}
                      onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })}
                      onKeyDown={handlePriceKeyDown}
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2 lg:col-span-1">
                    <Label htmlFor="stock">Quantity</Label>
                    <Input
                      ref={registerField(3)}
                      id="stock"
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={currentItem.stock}
                      onChange={(e) => setCurrentItem({ ...currentItem, stock: e.target.value })}
                      onKeyDown={handleStockKeyDown}
                      className="bg-white font-bold"
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <Button
                      ref={registerField(4)}
                      type="button"
                      variant="outline"
                      className="w-full border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 shadow-sm"
                      onClick={handleAddMore}
                      onKeyDown={(e) => handleKeyDown(e, 4)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item to Batch
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border rounded-xl p-4 bg-emerald-50/30 border-emerald-100 flex flex-col justify-between h-full">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Batch Summary</p>
                  <h4 className="text-2xl font-bold text-slate-900">
                    GHS {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h4>
                  <p className="text-sm text-slate-500">Total Investment Value</p>
                </div>
                
                <div className="pt-4 mt-4 border-t border-emerald-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Total Items:</span>
                    <span className="font-bold text-slate-900">{items.length + (currentItem.name && currentItem.stock ? 1 : 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden flex-1 flex flex-col min-h-0 shadow-sm">
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[40%]">Product Name</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-center w-24">Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-8 h-8 opacity-20" />
                          <p>No items added to this batch yet</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">GHS {parseFloat(item.cost).toFixed(2)}</TableCell>
                        <TableCell className="text-right">GHS {parseFloat(item.price).toFixed(2)}</TableCell>
                        <TableCell className="text-center font-bold text-slate-700">{item.stock}</TableCell>
                        <TableCell className="text-right font-semibold">
                          GHS {(parseFloat(item.cost) * parseInt(item.stock)).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0 sm:flex-row flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm font-medium text-slate-500">
              {items.length} items ready for processing
            </div>
            <div className="flex gap-3">
              <Button
                ref={registerField(5)}
                variant="outline"
                onClick={handleClose}
                onKeyDown={(e) => handleKeyDown(e, 5)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                ref={registerField(6)}
                disabled={submitting || (items.length === 0 && !currentItem.name)}
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px] shadow-sm"
                onKeyDown={(e) => handleKeyDown(e, 6)}
              >
                {submitting ? 'Processing...' : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Complete Addition
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

