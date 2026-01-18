import { useLiveQuery } from 'dexie-react-hooks'
import { dexieDb } from '@/lib/dexie'

export function useProducts() {
  return useLiveQuery(() => dexieDb.products.toArray())
}

export function useStores() {
  return useLiveQuery(() => dexieDb.stores.toArray())
}

export function useInventory(storeId?: string) {
  return useLiveQuery(() => {
    if (storeId) {
      return dexieDb.inventories.where('storeId').equals(storeId).toArray()
    }
    return dexieDb.inventories.toArray()
  }, [storeId])
}

export function useTransactions(storeId?: string) {
  return useLiveQuery(() => {
    if (storeId) {
      return dexieDb.transactions
        .where('storeId')
        .equals(storeId)
        .reverse()
        .sortBy('createdAt')
    }
    return dexieDb.transactions.reverse().sortBy('createdAt')
  }, [storeId])
}

export function useTransactionItems() {
  return useLiveQuery(() => dexieDb.transactionItems.toArray())
}

export function useUnsyncedCount() {
  return useLiveQuery(async () => {
    const txCount = await dexieDb.transactions.where('synced').equals(0).count()
    const queueCount = await dexieDb.syncQueue.count()
    return txCount + queueCount
  })
}

export function usePendingChanges() {
  return useLiveQuery(() => dexieDb.pendingChanges.reverse().sortBy('updatedAt'))
}

export function useTransfers() {
  return useLiveQuery(() => dexieDb.stockTransfers.reverse().sortBy('updatedAt'))
}

export function useTransferItems(transferId?: string) {
  return useLiveQuery(() => {
    if (transferId) {
      return dexieDb.stockTransferItems.where('stockTransferId').equals(transferId).toArray()
    }
    return dexieDb.stockTransferItems.toArray()
  }, [transferId])
}

export function useAdditions() {
  return useLiveQuery(() => dexieDb.inventoryAdditions.reverse().sortBy('updatedAt'))
}
