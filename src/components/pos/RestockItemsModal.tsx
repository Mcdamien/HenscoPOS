'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, X, Check, Search, Filter, Building2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALLOWED_SHOPS } from '@/lib/constants'
import { dexieDb } from '@/lib/dexie'

interface RestockItem {
  id: string
  itemId: number
  name: string
  cost: number
  price: number
  currentStock: number
  restockQty: number
  shop: string
}

interface RestockItemsModalProps {
  isOpen: boolean
  onClose: () => void
  onRestockComplete: () => void
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

interface Store {
  id: string
  name: string
}

export default function RestockItemsModal({ isOpen, onClose, onRestockComplete }: RestockItemsModalProps) {
  const [items, setItems] = useState<RestockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [filter, setFilter] = useState<'all' | 'out' | 'low'>('all')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [allStores, setAllStores] = useState<Store[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchStores().then((stores) => {
        if (selectedStoreId) {
          fetchLowStockItems(selectedStoreId)
        } else if (stores.length > 0) {
          const firstShop = stores.find(s => s.name !== 'Warehouse') || stores[0]
          setSelectedStoreId(firstShop.id)
          fetchLowStockItems(firstShop.id)
        }
      })
      
      // Auto-focus search input
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, selectedStoreId])

  const fetchLowStockItems = async (storeId: string) => {
    setLoading(true)
    try {
      const allProducts = await dexieDb.products.toArray()
      
      const storeInv = await dexieDb.inventories
        .where('storeId')
        .equals(storeId)
        .toArray()
      
      const invMap = new Map(storeInv.map(i => [i.productId, i.stock]))
      const currentStoreName = allStores.find(s => s.id === storeId)?.name || 'Unknown'

      const lowStockItems = allProducts
        .map(p => ({
          id: p.id,
          itemId: p.itemId,
          name: p.name,
          cost: p.cost,
          price: p.price,
          currentStock: invMap.get(p.id) || 0,
          restockQty: p.restockQty,
          shop: currentStoreName
        }))
        .filter(item => item.currentStock < 11)
      
      setItems(lowStockItems)
    } catch (error) {
      console.error('Failed to fetch low stock items:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    try {
      const storesFromDb = await dexieDb.stores.toArray()
      const shopsOnly = storesFromDb.filter(s => ALLOWED_SHOPS.includes(s.name as any))
      setAllStores(shopsOnly)
      return shopsOnly
    } catch (error) {
      console.error('Failed to fetch stores:', error)
      return []
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        String(item.itemId).includes(debouncedSearchTerm)
      const matchesFilter = filter === 'all' || 
        (filter === 'out' && item.currentStock === 0) ||
        (filter === 'low' && item.currentStock > 0)
      return matchesSearch && matchesFilter
    })
  }, [items, debouncedSearchTerm, filter])

  const outOfStockCount = useMemo(() => items.filter(i => i.currentStock === 0).length, [items])
  const lowStockCount = useMemo(() => items.filter(i => i.currentStock > 0).length, [items])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <DialogTitle className="text-xl">Items Needing Restock</DialogTitle>
            </div>
            <div className="flex items-center gap-2 mr-8">
              {outOfStockCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {outOfStockCount} Out of Stock
                </Badge>
              )}
              {lowStockCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {lowStockCount} Low Stock
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="bg-slate-50 border-b px-6 py-4 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white border rounded-lg p-1">
                <Button
                  variant={filter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="h-8 px-3 rounded-md"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'out' ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('out')}
                  className={cn("h-8 px-3 rounded-md", filter === 'out' ? "" : "text-red-600")}
                >
                  Out
                </Button>
                <Button
                  variant={filter === 'low' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('low')}
                  className={cn("h-8 px-3 rounded-md", filter === 'low' ? "bg-amber-600 hover:bg-amber-700" : "text-amber-600")}
                >
                  Low
                </Button>
              </div>

              <div className="min-w-[180px]">
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Select Store" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-4"></div>
              <p>Fetching stock levels...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
              <Package className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">All items are sufficiently stocked</p>
              <p className="text-sm">Try changing filters or selecting another store</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-24">Item ID</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Current Stock</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs font-medium text-slate-500">#{item.itemId}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "font-bold",
                        item.currentStock === 0 
                          ? 'bg-red-50 text-red-700 border-red-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      )}>
                        {item.currentStock} units
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {item.shop}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-slate-500 font-medium">
              Showing <span className="text-slate-900 font-bold">{filteredItems.length}</span> items
            </p>
            <Button variant="outline" onClick={onClose} className="px-8 shadow-sm">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
