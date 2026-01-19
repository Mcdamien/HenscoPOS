'use client'

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import { ShoppingCart, Search, Trash2, Printer, X, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import ReceiptModal from '@/components/pos/ReceiptModal'
import { handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useProducts, useInventory, useUnsyncedCount, useStores } from '@/hooks/useOfflineData'
import { useSync } from '@/components/providers/SyncProvider'
import { dexieDb } from '@/lib/dexie'
import { v4 as uuidv4 } from 'uuid'

interface POSTerminalViewProps {
  stores: string[]
  currentStore: string
  onStoreChange: (store: string) => void
}

interface Product {
  id: string
  itemId: number
  name: string
  price: number
  cost: number
  storeStock: number
}

interface CartItem extends Product {
  qty: number
}

interface Transaction {
  id: string
  transactionId: number
  date: string
  store: string
  subtotal: number
  tax: number
  total: number
  items: {
    id: string
    itemName: string
    itemPrice: number
    qty: number
  }[]
}

// Debounce hook for preventing excessive re-renders
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
// 0: Search input
// 1: Store select
// 2+: Cart quantity inputs (dynamic)
// Last: Pay button
const BASE_FIELD_COUNT = 2

// Memoized Cart Item to prevent unnecessary re-renders of the entire list
const CartItem = memo(({ 
  item, 
  onUpdateQty, 
  onRemove, 
  onQtyInput, 
  formatCurrency,
  inputRef,
  onKeyDown,
  tabIndex
}: { 
  item: CartItem, 
  onUpdateQty: (id: string, change: number) => void, 
  onRemove: (id: string) => void,
  onQtyInput: (id: string, val: string) => void,
  formatCurrency: (val: number) => string,
  inputRef: (el: HTMLInputElement | null) => void,
  onKeyDown: (e: React.KeyboardEvent, index: number) => void,
  tabIndex: number
}) => {
  return (
    <div className="border-b border-dashed border-slate-200 pb-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-sm">{item.name}</h4>
          <p className="text-xs text-slate-500">{formatCurrency(item.price)} x {item.qty}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          className="text-red-600 hover:text-red-700"
          tabIndex={-1}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQty(item.id, -1)}
          tabIndex={-1}
        >
          -
        </Button>
        <Input
          type="number"
          value={item.qty}
          onChange={(e) => onQtyInput(item.id, e.target.value)}
          onKeyDown={(e) => {
            onKeyDown(e, tabIndex)
            handleIntegerKeyDown(e as any)
          }}
          ref={inputRef}
          className="w-16 text-center"
          min={1}
          tabIndex={tabIndex}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQty(item.id, 1)}
          tabIndex={-1}
        >
          +
        </Button>
      </div>
    </div>
  )
})

CartItem.displayName = 'CartItem'

export default function POSTerminalView({ stores, currentStore, onStoreChange }: POSTerminalViewProps) {
  const { isOnline, isSyncing, sync } = useSync()
  const unsyncedCount = useUnsyncedCount() || 0
  
  const allProducts = useProducts() || []
  const storeInventory = useInventory() || [] // We'll filter this manually for now or use a better hook
  const allStores = useStores() || []
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(false)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)

  const currentStoreId = useMemo(() => {
    return allStores.find(s => s.name === currentStore)?.id
  }, [allStores, currentStore])
  
  // Refs for keyboard navigation and scrolling
  const searchInputRef = useRef<HTMLInputElement>(null)
  const storeSelectRef = useRef<HTMLButtonElement>(null)
  const payButtonRef = useRef<HTMLButtonElement>(null)
  const cartContainerRef = useRef<HTMLDivElement>(null)
  const quantityInputs = useRef<Record<string, HTMLInputElement | null>>({})

  // Derived products for the current store
  const products = useMemo(() => {
    if (!currentStoreId) return []

    return allProducts.map(p => {
      const inv = storeInventory.find(i => i.productId === p.id && i.storeId === currentStoreId)
      return {
        ...p,
        storeStock: inv ? inv.stock : 0
      }
    })
  }, [allProducts, storeInventory, currentStoreId])

  // Process checkout function
  const processCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!')
      return
    }

    if (!currentStoreId) {
      toast.error('Store ID not found!')
      return
    }

    setLoading(true)
    const transactionId = Math.floor(Math.random() * 1000000)
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
    const tax = subtotal * 0.125
    const total = subtotal + tax

    const newTransaction = {
      id: uuidv4(),
      transactionId,
      storeId: currentStoreId,
      subtotal,
      tax,
      total,
      createdAt: new Date(),
      synced: 0
    }

    try {
      // 1. Save to local Dexie first
      await dexieDb.transaction('rw', dexieDb.transactions, dexieDb.transactionItems, dexieDb.inventories, async () => {
        await dexieDb.transactions.add(newTransaction)
        
        const itemAdds = cart.map(item => ({
          id: uuidv4(),
          transactionId: newTransaction.id,
          productId: item.id,
          itemName: item.name,
          itemPrice: item.price,
          itemCost: item.cost, // Assuming cost is in Product
          qty: item.qty
        }))
        
        await dexieDb.transactionItems.bulkAdd(itemAdds)

        // Update local inventory
        for (const item of cart) {
          const inv = await dexieDb.inventories
            .where('[storeId+productId]')
            .equals([currentStoreId, item.id])
            .first()
          
          if (inv) {
            await dexieDb.inventories.update(inv.id, {
              stock: inv.stock - item.qty,
              updatedAt: new Date()
            })
          }
        }
      })

      // 2. Try to sync if online
      if (isOnline) {
        try {
          const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...newTransaction,
              items: cart
            })
          })

          if (response.ok) {
            const serverTx = await response.json()
            await dexieDb.transactions.update(newTransaction.id, { synced: 1 })
            setSelectedTransaction({ 
              ...serverTx, 
              transactionId: serverTx.transactionId || newTransaction.transactionId,
              store: currentStore,
              items: cart.map(i => ({ ...i, itemName: i.name, itemPrice: i.price }))
            })
          } else {
            setSelectedTransaction({ 
              ...newTransaction, 
              transactionId: newTransaction.transactionId,
              store: currentStore, 
              date: newTransaction.createdAt.toISOString(), 
              items: cart.map(i => ({ ...i, itemName: i.name, itemPrice: i.price })) 
            })
            toast.info('Saved locally. Will sync later.')
          }
        } catch (e) {
          setSelectedTransaction({ 
            ...newTransaction, 
            transactionId: newTransaction.transactionId,
            storeId: currentStoreId, 
            date: newTransaction.createdAt.toISOString(), 
            items: cart.map(i => ({ ...i, itemName: i.name, itemPrice: i.price })) 
          } as any)
          toast.info('Saved locally. Will sync later.')
        }
      } else {
        setSelectedTransaction({ 
          ...newTransaction, 
          transactionId: newTransaction.transactionId,
          storeId: currentStoreId, 
          date: newTransaction.createdAt.toISOString(), 
          items: cart.map(i => ({ ...i, itemName: i.name, itemPrice: i.price })) 
        } as any)
        toast.info('Offline: Saved locally.')
      }

      setCart([])
    } catch (error) {
      console.error('Checkout failed:', error)
      toast.error('Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  // Keyboard navigation for main fields
  const mainFieldCount = BASE_FIELD_COUNT + 1 // +1 for pay button

  const { focusField: focusMainField, handleKeyDown: handleMainKeyDown } = useKeyboardNavigation({
    fieldCount: mainFieldCount,
    onEnterSubmit: processCheckout
  })

  useEffect(() => {
    // Auto-focus search input on mount
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
  }, [currentStore])

  // Handle focus and scrolling when an item is added
  useEffect(() => {
    if (focusedItemId && quantityInputs.current[focusedItemId]) {
      const inputElement = quantityInputs.current[focusedItemId]
      
      // Focus the input
      inputElement?.focus()
      
      // Select all text in the input for easy replacement
      inputElement?.select()
      
      // Scroll to center the item in the cart container
      if (cartContainerRef.current) {
        const container = cartContainerRef.current
        const itemElement = inputElement?.closest('.border-b')
        
        if (itemElement) {
          const containerHeight = container.clientHeight
          const itemTop = (itemElement as HTMLElement).offsetTop
          const itemHeight = (itemElement as HTMLElement).clientHeight
          
          // Calculate scroll position to center the item
          const targetScroll = itemTop - (containerHeight / 2) + (itemHeight / 2)
          
          container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          })
        }
      }
      
      // Clear focusedItemId after focus is handled
      setFocusedItemId(null)
    }
  }, [focusedItemId, cart])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }, [])

  const addToCart = useCallback((product: Product) => {
    if (product.storeStock <= 0) {
      toast.error(`Out of stock in ${currentStore}!`)
      return
    }

    const existingItem = cart.find(i => i.id === product.id)

    if (existingItem) {
      if (existingItem.qty >= product.storeStock) {
        toast.error('Max stock reached for this item')
        return
      }
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, qty: item.qty + 1 }
          : item
      ))
      // Focus on existing item's quantity box
      setFocusedItemId(product.id)
    } else {
      setCart([...cart, { ...product, qty: 1 }])
      // Focus on newly added item's quantity box
      setFocusedItemId(product.id)
    }
  }, [cart, currentStore])

  const updateQty = useCallback((productId: string, change: number) => {
    const product = products.find(p => p.id === productId)
    const item = cart.find(i => i.id === productId)

    if (!item || !product) return

    const newQty = item.qty + change

    if (newQty > product.storeStock) {
      toast.error(`Max stock reached at ${currentStore}`)
      return
    }

    if (newQty <= 0) {
      setCart(cart.filter(i => i.id !== productId))
    } else {
      setCart(cart.map(i => 
        i.id === productId ? { ...i, qty: newQty } : i
      ))
    }
  }, [cart, products, currentStore])

  const removeFromCart = useCallback((productId: string) => {
    setCart(cart.filter(i => i.id !== productId))
  }, [cart])

  const clearCart = useCallback(() => {
    if (confirm('Are you sure you want to clear cart?')) {
      setCart([])
    }
  }, [])

  const handleQtyInput = useCallback((productId: string, value: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    // Allow empty string for typing
    if (value === '') {
      return
    }

    const newQty = parseInt(value)

    if (isNaN(newQty) || newQty <= 0) {
      // Don't show confirm dialog on every keystroke - just remove the item
      // User can use the trash button to remove items explicitly
      removeFromCart(productId)
      return
    }

    if (newQty > product.storeStock) {
      toast.error(`Only ${product.storeStock} in stock at ${currentStore}!`)
      return
    }

    setCart(cart.map(i => 
      i.id === productId ? { ...i, qty: newQty } : i
    ))
  }, [cart, products, currentStore, removeFromCart])

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart])
  const tax = subtotal * 0.125
  const total = subtotal + tax

  const filteredProducts = useMemo(() => products.filter(p => 
    p.storeStock > 0 && (
      p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      String(p.itemId).includes(debouncedSearchTerm)
    )
  ), [products, debouncedSearchTerm])

  // Handle keyboard navigation for cart quantity inputs
  const handleCartItemKeyDown = useCallback((e: React.KeyboardEvent, itemIndex: number) => {
    const totalFields = BASE_FIELD_COUNT + cart.length // search + store + cart items
    
    if (e.key === 'Tab') {
      e.preventDefault()
      
      if (e.shiftKey) {
        // Shift+Tab: Go to previous field
        if (itemIndex === 0) {
          // If first cart item, go to store select
          storeSelectRef.current?.focus()
        } else {
          // Go to previous cart item
          const prevIndex = itemIndex - 1
          const prevItem = cart[prevIndex]
          if (prevItem && quantityInputs.current[prevItem.id]) {
            quantityInputs.current[prevItem.id]?.focus()
          }
        }
      } else {
        // Tab: Go to next field
        if (itemIndex === cart.length - 1) {
          // If last cart item, go to pay button
          payButtonRef.current?.focus()
        } else {
          // Go to next cart item
          const nextIndex = itemIndex + 1
          const nextItem = cart[nextIndex]
          if (nextItem && quantityInputs.current[nextItem.id]) {
            quantityInputs.current[nextItem.id]?.focus()
          }
        }
      }
    } else if (e.key === 'Enter') {
      // Enter key on quantity input - could trigger update or checkout
      // For now, just keep the default behavior
    }
  }, [cart])

  // Handle keyboard navigation for search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      storeSelectRef.current?.focus()
    } else {
      handleMainKeyDown(e, 0)
    }
  }

  // Handle keyboard navigation for store select
  const handleStoreSelectKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      searchInputRef.current?.focus()
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      // If cart has items, focus on first item; otherwise go to pay button
      if (cart.length > 0) {
        const firstItem = cart[0]
        if (firstItem && quantityInputs.current[firstItem.id]) {
          quantityInputs.current[firstItem.id]?.focus()
        }
      } else {
        payButtonRef.current?.focus()
      }
    }
  }

  // Focus search input when component loads
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [])

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden pt-0 px-2 pb-4 gap-4 bg-slate-50">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-4">
        {/* Search and Store Selection */}
        <div className="flex gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search by Name or Item ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 bg-white"
            />
          </div>
          <Select value={currentStore} onValueChange={onStoreChange}>
            <SelectTrigger 
              ref={storeSelectRef}
              className="w-64 bg-white"
              onKeyDown={handleStoreSelectKeyDown}
            >
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store} value={store}>
                  {store}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 px-3 bg-white border border-slate-200 rounded-md shrink-0">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs font-medium text-slate-600 uppercase">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sync()}
              disabled={isSyncing || !isOnline}
              className="h-8 w-8 p-0"
              title="Sync now"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            {unsyncedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {unsyncedCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Scrollable Item Cards Container */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-white border-slate-200">
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-slate-500 py-8">Loading...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No products found matching "{debouncedSearchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="p-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all border border-slate-100 shadow-sm"
                    onClick={() => addToCart(product)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        addToCart(product)
                      }
                    }}
                  >
                    <div className="text-center">
                      <Badge variant="outline" className="mb-2">#{product.itemId}</Badge>
                      <p className="font-medium text-sm mb-2 h-10 overflow-hidden line-clamp-2">{product.name}</p>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(product.price)}</p>
                      <p className="text-xs text-slate-500 mt-1">{product.storeStock} in stock</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Fixed Cart Section */}
      <Card className="w-96 flex flex-col h-full overflow-hidden shrink-0 bg-white border-l">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold">Current Order</h3>
          <Button variant="outline" size="sm" onClick={clearCart}>
            Clear
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4" ref={cartContainerRef}>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>No items added yet</p>
              <p className="text-xs text-slate-400">Press Tab to navigate here after adding items</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQty={updateQty}
                  onRemove={removeFromCart}
                  onQtyInput={handleQtyInput}
                  formatCurrency={formatCurrency}
                  inputRef={(el) => { quantityInputs.current[item.id] = el }}
                  onKeyDown={handleCartItemKeyDown}
                  tabIndex={BASE_FIELD_COUNT + index}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>VAT (12.5%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="text-emerald-600">{formatCurrency(total)}</span>
            </div>
          </div>
          <Button 
            ref={payButtonRef}
            className="w-full h-12 text-lg" 
            onClick={processCheckout}
            disabled={cart.length === 0}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                // If cart has items, focus on last item; otherwise go to store select
                if (cart.length > 0) {
                  const lastItem = cart[cart.length - 1]
                  if (lastItem && quantityInputs.current[lastItem.id]) {
                    quantityInputs.current[lastItem.id]?.focus()
                  }
                } else {
                  searchInputRef.current?.focus()
                }
              } else if (e.key === 'Enter') {
                processCheckout()
              }
            }}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Pay
          </Button>
        </div>
      </Card>

      {selectedTransaction && (
        <ReceiptModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
        />
      )}
    </div>
  )
}

