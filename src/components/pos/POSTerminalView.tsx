'use client'

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import { ShoppingCart, Search, Trash2, Printer, X, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import ReceiptModal from '@/components/pos/ReceiptModal'
import { handleIntegerKeyDown } from '@/lib/utils'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useProducts, useInventory, useUnsyncedCount, useStores } from '@/hooks/useOfflineData'
import { useSync } from '@/components/providers/SyncProvider'
import { dexieDb } from '@/lib/dexie'
import { v4 as uuidv4 } from 'uuid'

import { useIsMobile } from '@/hooks/use-mobile'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'

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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart])
  const tax = useMemo(() => subtotal * 0.125, [subtotal])
  const total = useMemo(() => subtotal + tax, [subtotal, tax])

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      String(p.itemId).includes(debouncedSearchTerm)
    )
  }, [products, debouncedSearchTerm])

  // Keyboard navigation for main fields
  const mainFieldCount = BASE_FIELD_COUNT + 1 // +1 for pay button

  const { focusField: focusMainField, handleKeyDown: handleMainKeyDown } = useKeyboardNavigation({
    fieldCount: mainFieldCount,
    onEnterSubmit: processCheckout
  })

  // Specific key handlers for the inputs
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      // If we have search results, we might want to focus them, but for now just move to next main field
      focusMainField(1)
    } else {
      handleMainKeyDown(e, 0)
    }
  }

  const handleStoreSelectKeyDown = (e: React.KeyboardEvent) => {
    handleMainKeyDown(e, 1)
  }

  const handleCartItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      focusMainField(mainFieldCount - 1) // Jump to Pay button
    } else {
      handleMainKeyDown(e, index)
    }
  }

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

  const isMobile = useIsMobile()
  const [showMobileCart, setShowMobileCart] = useState(false)

  const CartContent = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            Order
          </h3>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {cart.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-slate-500 text-xs h-8">
          Clear
        </Button>
      </div>

      <div 
        ref={cartContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
            <ShoppingCart className="w-8 h-8" />
            <p className="text-sm text-center px-8">Your order is empty</p>
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

      <div className="p-4 bg-slate-50 border-t space-y-3 shrink-0">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>VAT (12.5%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-slate-800 pt-2 border-t border-slate-200">
            <span>Total</span>
            <span className="text-emerald-700">{formatCurrency(total)}</span>
          </div>
        </div>
        
        <Button 
          onClick={processCheckout}
          disabled={cart.length === 0 || loading}
          className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
          ref={payButtonRef}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && e.shiftKey) {
              e.preventDefault()
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
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            `Pay ${formatCurrency(total)}`
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-slate-50 relative overflow-hidden">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col min-h-0 md:border-r border-slate-200 overflow-hidden">
        <div className="p-3 md:p-4 space-y-3 bg-white border-b border-slate-100 shadow-sm z-10 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products... (F2)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 h-10 bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-lg"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={currentStore} onValueChange={onStoreChange}>
                <SelectTrigger 
                  ref={storeSelectRef}
                  className="h-10 bg-slate-50 border-slate-200 rounded-lg"
                  onKeyDown={handleStoreSelectKeyDown}
                >
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store} value={store}>{store}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                )}
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {unsyncedCount > 0 && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold">
                  {unsyncedCount} PENDING
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => sync()}
              disabled={isSyncing || !isOnline}
              className="h-7 text-[10px] font-bold gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 px-2"
            >
              <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
              SYNC
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 scroll-smooth min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
              <p className="text-sm">Loading inventory...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
              <div className="p-4 rounded-full bg-slate-100">
                <Search className="w-8 h-8 opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-600">No products found</p>
                <p className="text-sm px-8">Try searching for something else</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-24 md:pb-4">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id}
                  className={cn(
                    "group relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-emerald-200 cursor-pointer active:scale-[0.98] border-slate-100 bg-white",
                    product.storeStock <= 0 && "opacity-60 bg-slate-50 grayscale"
                  )}
                  onClick={() => addToCart(product)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      addToCart(product)
                    }
                  }}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="font-medium text-slate-800 text-xs line-clamp-2 min-h-[2rem]">
                        {product.name}
                      </h3>
                      <Badge variant="outline" className="shrink-0 text-[9px] px-1 h-4">
                        #{product.itemId}
                      </Badge>
                    </div>
                    
                    <div className="flex items-end justify-between gap-1 pt-1">
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-emerald-600 leading-none">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          Stock: {product.storeStock}
                        </p>
                      </div>
                      <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                  
                  {product.storeStock <= 0 && (
                    <div className="absolute inset-0 bg-slate-100/40 flex items-center justify-center backdrop-blur-[1px]">
                      <span className="bg-white/90 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-red-100 uppercase tracking-tighter">
                        Sold Out
                      </span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart Sidebar */}
      {!isMobile && (
        <Card className="w-80 lg:w-96 flex flex-col h-full overflow-hidden shrink-0 bg-white border-l rounded-none shadow-none">
          <CartContent />
        </Card>
      )}

      {/* Mobile Cart Button and Sheet */}
      {isMobile && (
        <>
          <div className="fixed bottom-20 right-4 z-40 md:hidden">
            <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
              <SheetTrigger asChild>
                <Button 
                  size="lg" 
                  className="rounded-full w-14 h-14 shadow-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 border-4 border-white"
                >
                  <div className="relative">
                    <ShoppingCart className="w-6 h-6 text-white" />
                    {cart.length > 0 && (
                      <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                        {cart.length}
                      </span>
                    )}
                  </div>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="p-0 h-[85vh] rounded-t-3xl overflow-hidden border-none shadow-2xl">
                <SheetHeader className="sr-only">
                  <SheetTitle>Order Summary</SheetTitle>
                </SheetHeader>
                <CartContent />
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between z-30 md:hidden shadow-[0_-4px_15px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Payable</span>
              <span className="text-lg font-black text-emerald-700 leading-none">{formatCurrency(total)}</span>
            </div>
            <Button 
              size="sm" 
              className="bg-emerald-600 h-10 px-6 rounded-xl font-bold text-sm shadow-md shadow-emerald-100"
              onClick={() => setShowMobileCart(true)}
              disabled={cart.length === 0}
            >
              Order Details ({cart.length})
            </Button>
          </div>
        </>
      )}

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

