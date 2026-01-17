'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Truck, Search, Send, Calendar, CheckSquare, Square } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { handleIntegerKeyDown } from '@/lib/utils'

interface Product {
  id: string
  itemId: number
  name: string
  price: number
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

export default function TransferModal({ isOpen, onClose, stores, currentStore, products, onSuccess }: TransferModalProps) {
  const [targetStore, setTargetStore] = useState('')
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, string>>({})
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset target store when modal opens if not set
  useEffect(() => {
    if (isOpen && !targetStore) {
      const firstAvailable = stores.find(s => s !== currentStore)
      if (firstAvailable) setTargetStore(firstAvailable)
    }
  }, [isOpen, stores, currentStore, targetStore])

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products
    const query = searchTerm.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      String(p.itemId).includes(query)
    )
  }, [products, searchTerm])

  const handleQtyChange = (productId: string, value: string) => {
    setSelectedQuantities(prev => ({ ...prev, [productId]: value }))
    if (value && parseInt(value) > 0) {
      setCheckedIds(prev => {
        const next = new Set(prev)
        next.add(productId)
        return next
      })
    } else if (value === '0' || value === '') {
      setCheckedIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const toggleItem = (productId: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
        if (!selectedQuantities[productId] || selectedQuantities[productId] === '0') {
          setSelectedQuantities(q => ({ ...q, [productId]: '1' }))
        }
      }
      return next
    })
  }

  const setPresetQty = (productId: string, qty: number, stock: number) => {
    const finalQty = Math.min(qty, stock)
    setSelectedQuantities(prev => ({ ...prev, [productId]: String(finalQty) }))
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.add(productId)
      return next
    })
    if (qty > stock) {
      toast.warning(`Limited to available stock (${stock})`)
    }
  }

  const applyGlobalPreset = (qty: number) => {
    const newQuantities = { ...selectedQuantities }
    const newChecked = new Set(checkedIds)
    
    products.forEach(product => {
      if (product.warehouseStock >= qty) {
        newQuantities[product.id] = String(qty)
        newChecked.add(product.id)
      } else {
        // Skip items with insufficient stock
        delete newQuantities[product.id]
        newChecked.delete(product.id)
      }
    })
    
    setSelectedQuantities(newQuantities)
    setCheckedIds(newChecked)
    toast.success(`Applied preset ${qty} to items with sufficient stock`)
  }

  const handleSubmit = async () => {
    const itemsToTransfer = Array.from(checkedIds)
      .map(id => ({
        productId: id,
        qty: parseInt(selectedQuantities[id] || '0')
      }))
      .filter(item => item.qty > 0)

    if (itemsToTransfer.length === 0) {
      toast.error('Please select at least one item with a quantity greater than 0')
      return
    }

    if (!targetStore) {
      toast.error('Please select a destination shop')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToTransfer,
          targetStore
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

  const handleClose = () => {
    setSelectedQuantities({})
    setCheckedIds(new Set())
    setSearchTerm('')
    onClose()
  }

  const presets = [10, 30, 50, 100]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Truck className="w-6 h-6 text-emerald-600" />
                Stock Transfer System
              </DialogTitle>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {targetStore && (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    TO: {targetStore}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-6 space-y-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
            <div>
              <Label htmlFor="targetStore">Destination Shop</Label>
              <Select 
                value={targetStore} 
                onValueChange={setTargetStore}
              >
                <SelectTrigger id="targetStore">
                  <SelectValue placeholder="-- Select Destination --" />
                </SelectTrigger>
                <SelectContent>
                  {stores.filter(s => s !== currentStore).map((store) => (
                    <SelectItem key={store} value={store}>
                      {store}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-12 text-center">Sel</TableHead>
                    <TableHead>Product Details</TableHead>
                    <TableHead className="text-right w-24">Price</TableHead>
                    <TableHead className="text-center w-24">Whse Stock</TableHead>
                    <TableHead className="w-40">Transfer Qty</TableHead>
                    <TableHead className="hidden md:table-cell text-right w-56">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] uppercase text-slate-400">Apply All</span>
                        <div className="flex gap-1">
                          {presets.map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => applyGlobalPreset(p)}
                              className="px-2 py-0.5 text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-20" />
                          <p>No products found matching your search</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className={checkedIds.has(product.id) ? 'bg-emerald-50/50' : ''}>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => toggleItem(product.id)}
                            className={`p-1.5 rounded-md transition-colors ${
                              checkedIds.has(product.id) ? 'bg-emerald-100 text-emerald-600' : 'text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {checkedIds.has(product.id) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{product.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">CODE: {product.itemId}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          GHS {product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700">
                          {product.warehouseStock}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={product.warehouseStock}
                            value={selectedQuantities[product.id] || ''}
                            onChange={(e) => handleQtyChange(product.id, e.target.value)}
                            onKeyDown={handleIntegerKeyDown}
                            className={`h-9 font-medium ${checkedIds.has(product.id) ? 'border-emerald-500 ring-1 ring-emerald-500/20' : ''}`}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-xs text-slate-400">
                          {checkedIds.has(product.id) ? 'Selected' : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 border-t p-4 sm:flex-row flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm font-medium">
              <span className="text-slate-500">Selected:</span>
              <span className="ml-1 text-emerald-600">{checkedIds.size} items</span>
            </div>
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={submitting || checkedIds.size === 0 || !targetStore}
                className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px] shadow-sm"
              >
                {submitting ? 'Processing...' : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Transfer
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
