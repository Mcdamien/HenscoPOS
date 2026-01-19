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
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { handleIntegerKeyDown } from '@/lib/utils'
import { dexieDb } from '@/lib/dexie'
import { useSync } from '@/components/providers/SyncProvider'
import { v4 as uuidv4 } from 'uuid'

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
  const isMobile = useIsMobile()
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

  const { isOnline, sync } = useSync()

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
      const transferData = {
        items: itemsToTransfer,
        targetStore
      }

      // 1. Save locally to Dexie
      const newTransferId = uuidv4()
      await dexieDb.transaction('rw', dexieDb.stockTransfers, dexieDb.stockTransferItems, dexieDb.syncQueue, async () => {
        await dexieDb.stockTransfers.add({
          id: newTransferId,
          transferId: Math.floor(Math.random() * 1000000), // Temporary ID
          fromStore: 'Warehouse',
          toStore: targetStore,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        })

        await dexieDb.stockTransferItems.bulkAdd(itemsToTransfer.map(item => ({
          id: uuidv4(),
          stockTransferId: newTransferId,
          productId: item.productId,
          itemName: products.find(p => p.id === item.productId)?.name || 'Unknown',
          qty: item.qty
        })))

        // 2. Add to Sync Queue
        await dexieDb.syncQueue.add({
          table: 'stockTransfers',
          action: 'create',
          data: transferData,
          timestamp: Date.now()
        })
      })

      toast.success('Transfer saved locally!')
      handleClose()
      onSuccess()

      // 3. Try to sync immediately if online
      if (isOnline) {
        sync()
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
      <DialogContent className={cn(
        "max-h-[95vh] flex flex-col p-0 overflow-hidden",
        isMobile ? "w-full h-full max-w-none rounded-none" : "max-w-7xl"
      )}>
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                Stock Transfer
              </DialogTitle>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium">
                <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Calendar className="w-3 h-3" />
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {targetStore && (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tight">
                    TO: {targetStore}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0 px-4 sm:px-6">
            <div className="space-y-1.5">
              <Label htmlFor="targetStore" className="text-xs font-bold uppercase text-slate-500">Destination Shop</Label>
              <Select 
                value={targetStore} 
                onValueChange={setTargetStore}
              >
                <SelectTrigger id="targetStore" className="h-11 bg-slate-50 border-slate-200">
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

            <div className="space-y-1.5">
              <Label htmlFor="search" className="text-xs font-bold uppercase text-slate-500">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="border-y sm:border rounded-none sm:rounded-lg overflow-hidden flex-1 flex flex-col min-h-0 sm:mx-6">
            {!isMobile && (
              <div className="bg-slate-50 border-b p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Apply All Quantities:</span>
                <div className="flex gap-2">
                  {presets.map(p => (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => applyGlobalPreset(p)}
                      className="h-7 px-3 text-[10px] font-bold bg-white"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto bg-slate-50/20">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>No products found</p>
                  </div>
                </div>
              ) : isMobile ? (
                <div className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className={cn(
                        "p-4 bg-white flex flex-col gap-3",
                        checkedIds.has(product.id) && "bg-emerald-50/30"
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => toggleItem(product.id)}
                            className={cn(
                              "mt-1 p-0.5 rounded transition-colors",
                              checkedIds.has(product.id) ? 'text-emerald-600' : 'text-slate-300'
                            )}
                          >
                            {checkedIds.has(product.id) ? (
                              <CheckSquare className="w-6 h-6" />
                            ) : (
                              <Square className="w-6 h-6" />
                            )}
                          </button>
                          <div>
                            <div className="font-bold text-slate-800">{product.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">#{product.itemId}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-900">GHS {product.price.toLocaleString()}</div>
                          <div className="text-[10px] font-medium text-slate-500">Whse: {product.warehouseStock}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          max={product.warehouseStock}
                          value={selectedQuantities[product.id] || ''}
                          onChange={(e) => handleQtyChange(product.id, e.target.value)}
                          onKeyDown={handleIntegerKeyDown}
                          className={cn(
                            "h-10 font-bold",
                            checkedIds.has(product.id) && "border-emerald-500 ring-1 ring-emerald-500/10"
                          )}
                          placeholder="0"
                        />
                        <div className="flex gap-1">
                          {[10, 50].map(p => (
                            <Button
                              key={p}
                              variant="outline"
                              size="sm"
                              className="h-10 w-12 text-[10px] font-bold p-0"
                              onClick={() => setPresetQty(product.id, p, product.warehouseStock)}
                            >
                              {p}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center">Sel</TableHead>
                      <TableHead>Product Details</TableHead>
                      <TableHead className="text-right w-24">Price</TableHead>
                      <TableHead className="text-center w-24">Whse Stock</TableHead>
                      <TableHead className="w-40">Transfer Qty</TableHead>
                      <TableHead className="hidden md:table-cell text-right w-56">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className={checkedIds.has(product.id) ? 'bg-emerald-50/50' : ''}>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => toggleItem(product.id)}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              checkedIds.has(product.id) ? 'text-emerald-600' : 'text-slate-300 hover:bg-slate-100'
                            )}
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
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">#{product.itemId}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                            className={cn(
                              "h-9 font-medium",
                              checkedIds.has(product.id) && "border-emerald-500 ring-1 ring-emerald-500/20"
                            )}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-xs text-slate-400">
                          {checkedIds.has(product.id) && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Selected</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 border-t p-4 shrink-0 sm:px-6">
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Items</span>
              <span className="text-lg font-black text-emerald-700 leading-none">{checkedIds.size}</span>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="h-11 px-4 sm:px-6 font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={submitting || checkedIds.size === 0 || !targetStore}
                className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 sm:min-w-[160px] font-bold shadow-lg shadow-emerald-100"
              >
                {submitting ? 'Processing...' : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {isMobile ? "" : "Transfer"}
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
