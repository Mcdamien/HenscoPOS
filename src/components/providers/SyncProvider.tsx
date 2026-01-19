'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { dexieDb } from '@/lib/dexie'
import { toast } from 'sonner'

interface SyncContextType {
  isSyncing: boolean
  lastSync: Date | null
  sync: () => Promise<void>
  isOnline: boolean
}

const SyncContext = createContext<SyncContextType | undefined>(undefined)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline')
      return
    }

    setIsSyncing(true)
    try {
      // 1. Process Sync Queue FIRST
      const queueItems = await dexieDb.syncQueue.orderBy('timestamp').toArray()
      for (const item of queueItems) {
        try {
          let endpoint = ''
          let method = 'POST'
          
          if (item.table === 'inventoryAdditions') endpoint = '/api/inventory/addition'
          else if (item.table === 'stockTransfers') endpoint = '/api/transfer'
          else if (item.table === 'inventories') {
            if (item.action === 'delete') {
              const storeParam = item.data.storeId 
                ? `storeId=${item.data.storeId}` 
                : `storeName=${item.data.storeName}`
              endpoint = `/api/inventory?productId=${item.data.productId}&${storeParam}`
              method = 'DELETE'
            }
          }
          else if (item.table === 'pendingChanges') {
            if (item.action === 'create') endpoint = '/api/inventory/request-change'
            else if (item.action === 'approve') endpoint = '/api/inventory/approve-change'
            else if (item.action === 'reject') endpoint = '/api/inventory/reject-change'
            else if (item.action === 'update' && item.data.action === 'confirm-return') endpoint = '/api/inventory/confirm-return'
          }
          else if (item.table === 'products') {
            if (item.action === 'update') endpoint = '/api/products/restock'
            else if (item.action === 'create') endpoint = '/api/products'
            else if (item.action === 'bulk_create') endpoint = '/api/products/bulk'
            else if (item.action === 'delete') {
              endpoint = `/api/products?id=${item.data.id}`
              method = 'DELETE'
            }
          }
          
          if (endpoint) {
            const res = await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data)
            })
            
            if (res.ok) {
              await dexieDb.syncQueue.delete(item.id!)
            }
          }
        } catch (e) {
          console.error(`Failed to sync queue item ${item.id}:`, e)
        }
      }

      // 2. Sync Products
      const productsRes = await fetch('/api/products')
      if (productsRes.ok) {
        const products = await productsRes.json()
        await dexieDb.products.bulkPut(products)
      }

      // 3. Sync Stores
      const storesRes = await fetch('/api/stores')
      if (storesRes.ok) {
        const stores = await storesRes.json()
        await dexieDb.stores.bulkPut(stores)
      }

      // 4. Sync Inventories
      const invRes = await fetch('/api/inventory/all')
      if (invRes.ok) {
        const inv = await invRes.json()
        await dexieDb.inventories.bulkPut(inv)
      }

      // 5. Sync Pending Changes
      const pendingRes = await fetch('/api/inventory/pending-changes?status=pending')
      if (pendingRes.ok) {
        const data = await pendingRes.json()
        await dexieDb.pendingChanges.bulkPut(data.changes)
      }

      // 6. Sync Transfers
      const transfersRes = await fetch('/api/transfer')
      if (transfersRes.ok) {
        const transfers = await transfersRes.json()
        for (const t of transfers) {
          await dexieDb.stockTransfers.put({
            id: t.id,
            transferId: t.transferId,
            fromStore: t.fromStore,
            toStore: t.toStore,
            status: t.status,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
            confirmedAt: t.confirmedAt ? new Date(t.confirmedAt) : null,
            confirmedBy: t.confirmedBy,
            cancelledAt: t.cancelledAt ? new Date(t.cancelledAt) : null,
            cancelledReason: t.cancelledReason
          })
          if (t.items) {
            await dexieDb.stockTransferItems.bulkPut(t.items.map((i: any) => ({
              id: i.id,
              stockTransferId: t.id,
              productId: i.productId,
              itemName: i.itemName,
              qty: i.qty
            })))
          }
        }
      }

      // 7. Sync Additions
      const additionsRes = await fetch('/api/inventory/addition')
      if (additionsRes.ok) {
        const additions = await additionsRes.json()
        for (const a of additions) {
          await dexieDb.inventoryAdditions.put({
            id: a.id,
            additionId: a.additionId,
            referenceId: a.referenceId,
            totalCost: a.totalCost,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt)
          })
          if (a.items) {
            await dexieDb.inventoryAdditionItems.bulkPut(a.items.map((i: any) => ({
              id: i.id,
              inventoryAdditionId: a.id,
              productId: i.productId,
              itemName: i.itemName,
              cost: i.cost,
              price: i.price,
              qty: i.qty
            })))
          }
        }
      }

      // 8. Sync Recent Transactions
      const txRes = await fetch('/api/transactions')
      if (txRes.ok) {
        const transactions = await txRes.json()
        for (const tx of transactions) {
          await dexieDb.transactions.put({
            id: tx.id,
            transactionId: tx.transactionId,
            storeId: tx.storeId,
            subtotal: tx.subtotal,
            tax: tx.tax,
            total: tx.total,
            createdAt: new Date(tx.createdAt || tx.date),
            synced: 1
          })
          
          if (tx.items) {
            const items = tx.items.map((item: any) => ({
              id: item.id,
              transactionId: tx.id,
              productId: item.productId || item.id,
              itemName: item.itemName || item.name,
              itemPrice: item.itemPrice || item.price,
              itemCost: item.itemCost || 0,
              qty: item.qty
            }))
            await dexieDb.transactionItems.bulkPut(items)
          }
        }
      }

      // 9. Push unsynced transactions (Legacy way for POS)
      const unsyncedTransactions = await dexieDb.transactions
        .where('synced')
        .equals(0)
        .toArray()

      for (const tx of unsyncedTransactions) {
        const items = await dexieDb.transactionItems
          .where('transactionId')
          .equals(tx.id)
          .toArray()

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...tx, items })
        })

        if (res.ok) {
          await dexieDb.transactions.update(tx.id, { synced: 1 })
        }
      }

      setLastSync(new Date())
      toast.success('Synchronization complete')
    } catch (error) {
      console.error('Sync failed:', error)
      toast.error('Synchronization failed')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.info('You are back online. Syncing...')
      sync()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast.warning('You are offline. Changes will be saved locally.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync
    sync()

    // Periodic sync every 5 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) sync()
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [sync])

  return (
    <SyncContext.Provider value={{ isSyncing, lastSync, sync, isOnline }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const context = useContext(SyncContext)
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}
