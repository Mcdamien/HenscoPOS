'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, X, Check, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface RestockItem {
  id: string
  itemId: number
  name: string
  cost: number
  price: number
  currentStock: number
  restockQty: number
  shop: string // Added shop field
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

export default function RestockItemsModal({ isOpen, onClose, onRestockComplete }: RestockItemsModalProps) {
  const [items, setItems] = useState<RestockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [restockingId, setRestockingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [filter, setFilter] = useState<'all' | 'out' | 'low'>('all')
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [stores, setStores] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (selectedStore) {
        fetchLowStockItems(selectedStore)
      }
      fetchStores()
      // Auto-focus search input
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, selectedStore])

  const fetchLowStockItems = async (store: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/low-stock?store=${encodeURIComponent(store)}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error('Failed to fetch low stock items:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setStores(data)
          // Default to the first shop if none selected
          if (!selectedStore && data.length > 0) {
            setSelectedStore(data[0])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error)
    }
  }

  const handleRestock = async (item: RestockItem) => {
    setRestockingId(item.id)
    try {
      const response = await fetch('/api/products/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.id,
          cost: item.cost,
          price: item.price,
          qty: item.restockQty
        })
      })

      if (response.ok) {
        // Remove the restocked item from the list
        setItems(prev => prev.filter(i => i.id !== item.id))
        onRestockComplete()
      }
    } catch (error) {
      console.error('Failed to restock:', error)
    } finally {
      setRestockingId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const handleStoreChange = (store: string) => {
    setSelectedStore(store)
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

  const totalRestockCost = useMemo(() => 
    filteredItems.reduce((sum, item) => sum + (item.cost * item.restockQty), 0),
    [filteredItems]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Items Needing Restock</h2>
              <p className="text-sm text-slate-500">
                {outOfStockCount > 0 && (
                  <Badge variant="destructive" className="mr-2">
                    {outOfStockCount} Out of Stock
                  </Badge>
                )}
                {lowStockCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {lowStockCount} Low Stock
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({items.length})
              </Button>
              <Button
                variant={filter === 'out' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setFilter('out')}
              >
                Out of Stock ({outOfStockCount})
              </Button>
              <Button
                variant={filter === 'low' ? 'default' : 'outline'}
                size="sm"
                className={filter === 'low' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                onClick={() => setFilter('low')}
              >
                Low Stock ({lowStockCount})
              </Button>
            </div>
            <div className="flex-1 max-w-xs">
              <select
                value={selectedStore}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {stores.map((store) => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              Loading items...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No items need restock</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">#{item.itemId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(item.price)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={item.currentStock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                        {item.currentStock} units
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.shop}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {filteredItems.length} of {items.length} items
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

