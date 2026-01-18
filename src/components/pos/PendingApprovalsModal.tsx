'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Check, XCircle, Clock, Package, Store, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { usePendingChanges, useProducts, useStores } from '@/hooks/useOfflineData'
import { dexieDb } from '@/lib/dexie'
import { useSync } from '@/components/providers/SyncProvider'
import { useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'

interface PendingChange {
  id: string
  productId: string
  storeId: string
  product?: {
    id: string
    itemId: number
    name: string
  }
  store?: {
    id: string
    name: string
  }
  changeType: string
  qty: number
  newCost: number | null
  newPrice: number | null
  reason: string | null
  status: string
  requestedBy: string | null
  createdAt: Date
}

interface PendingApprovalsModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function PendingApprovalsModal({ isOpen, onClose, onRefresh }: PendingApprovalsModalProps) {
  const offlineChanges = usePendingChanges() || []
  const allProducts = useProducts() || []
  const allStores = useStores() || []
  const { isOnline, sync } = useSync()
  
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null)
  const rejectInputRef = useRef<HTMLInputElement>(null)

  const joinedChanges = useMemo(() => {
    const productMap = new Map(allProducts.map(p => [p.id, p]))
    const storeIdMap = new Map(allStores.map(s => [s.id, s]))
    const storeNameMap = new Map(allStores.map(s => [s.name, s]))

    return offlineChanges.map(change => ({
      ...change,
      product: productMap.get(change.productId),
      store: storeIdMap.get(change.storeId) || storeNameMap.get(change.storeId)
    })) as PendingChange[]
  }, [offlineChanges, allProducts, allStores])

  const changes = joinedChanges.filter(c => c.status === 'pending')
  const loading = false // Not really loading from network anymore

  const handleApprove = async (change: PendingChange) => {
    setProcessingId(change.id)
    try {
      const approveData = {
        pendingChangeId: change.id,
        reviewedBy: 'Warehouse Manager'
      }

      // 1. Update locally
      await dexieDb.transaction('rw', [dexieDb.pendingChanges, dexieDb.syncQueue, dexieDb.products, dexieDb.inventories], async () => {
        // Update pending change status
        await dexieDb.pendingChanges.update(change.id, {
          status: 'approved',
          reviewedBy: approveData.reviewedBy,
          reviewedAt: new Date(),
          updatedAt: new Date()
        })

        // Apply inventory changes locally
        const product = await dexieDb.products.get(change.productId)
        const inventory = await dexieDb.inventories
          .where('[storeId+productId]')
          .equals([change.storeId, change.productId])
          .first()

        if (change.changeType === 'add') {
          if (product) {
            await dexieDb.products.update(product.id, {
              warehouseStock: Math.max(0, product.warehouseStock - change.qty),
              updatedAt: new Date()
            })
          }
          if (inventory) {
            await dexieDb.inventories.update(inventory.id, {
              stock: inventory.stock + change.qty,
              updatedAt: new Date()
            })
          } else {
            await dexieDb.inventories.add({
              id: uuidv4(),
              storeId: change.storeId,
              productId: change.productId,
              stock: change.qty,
              updatedAt: new Date()
            })
          }
        } else if (change.changeType === 'remove') {
          if (inventory) {
            await dexieDb.inventories.update(inventory.id, {
              stock: Math.max(0, inventory.stock - change.qty),
              updatedAt: new Date()
            })
          }
        } else if (change.changeType === 'return') {
          if (inventory) {
            await dexieDb.inventories.update(inventory.id, {
              stock: Math.max(0, inventory.stock - change.qty),
              updatedAt: new Date()
            })
          }
          if (product) {
            await dexieDb.products.update(product.id, {
              warehouseStock: product.warehouseStock + change.qty,
              updatedAt: new Date()
            })
          }
        } else if (change.changeType === 'remove_product') {
          if (product) {
            await dexieDb.products.update(product.id, {
              warehouseStock: product.warehouseStock + change.qty,
              updatedAt: new Date()
            })
          }
          if (inventory) {
            await dexieDb.inventories.delete(inventory.id)
          }
        } else if (change.changeType === 'adjust') {
          if (change.qty !== 0 && inventory) {
            const diff = change.qty - inventory.stock
            if (diff > 0 && product) {
              await dexieDb.products.update(product.id, {
                warehouseStock: Math.max(0, product.warehouseStock - diff),
                updatedAt: new Date()
              })
            }
            await dexieDb.inventories.update(inventory.id, {
              stock: change.qty,
              updatedAt: new Date()
            })
          }
          if (change.newCost !== null || change.newPrice !== null) {
            if (product) {
              await dexieDb.products.update(product.id, {
                cost: change.newCost !== null ? change.newCost : product.cost,
                price: change.newPrice !== null ? change.newPrice : product.price,
                updatedAt: new Date()
              })
            }
          }
        }

        // 2. Add to sync queue
        await dexieDb.syncQueue.add({
          table: 'pendingChanges',
          action: 'approve',
          data: approveData,
          timestamp: Date.now()
        })
      })

      toast.success(`Approved locally: ${change.product?.name || 'Unknown Product'}`)
      onRefresh()
      
      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to approve change:', error)
      toast.error('Failed to approve change')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (change: PendingChange) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setProcessingId(change.id)
    try {
      const rejectData = {
        pendingChangeId: change.id,
        reviewedBy: 'Warehouse Manager',
        reason: rejectReason
      }

      // 1. Update locally
      await dexieDb.transaction('rw', dexieDb.pendingChanges, dexieDb.syncQueue, async () => {
        await dexieDb.pendingChanges.update(change.id, {
          status: 'rejected',
          reviewedBy: rejectData.reviewedBy,
          reviewedAt: new Date(),
          updatedAt: new Date()
        })

        // 2. Add to sync queue
        await dexieDb.syncQueue.add({
          table: 'pendingChanges',
          action: 'reject',
          data: rejectData,
          timestamp: Date.now()
        })
      })

      toast.success(`Rejected locally: ${change.product?.name || 'Unknown Product'}`)
      setShowRejectInput(null)
      setRejectReason('')
      onRefresh()

      if (isOnline) {
        sync()
      }
    } catch (error) {
      console.error('Failed to reject change:', error)
      toast.error('Failed to reject change')
    } finally {
      setProcessingId(null)
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount || 0)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const getChangeTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      add: 'bg-emerald-100 text-emerald-700',
      remove: 'bg-red-100 text-red-700',
      adjust: 'bg-blue-100 text-blue-700',
      return: 'bg-amber-100 text-amber-700',
      remove_product: 'bg-orange-100 text-orange-700'
    }
    const labels: Record<string, string> = {
      add: 'Add',
      remove: 'Remove',
      adjust: 'Adjust',
      return: 'Return',
      remove_product: 'Return & Remove'
    }
    return (
      <Badge className={styles[type] || 'bg-slate-100 text-slate-700'}>
        {labels[type] || type}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Inventory Changes
            <Badge variant="secondary" className="ml-2">
              {changes.length} pending
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              Loading pending changes...
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-sm text-slate-500">No pending inventory changes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {changes.map((change) => (
                <div 
                  key={change.id} 
                  className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="w-4 h-4 text-slate-500" />
                      <span className="font-medium">{change.product?.name || 'Unknown Product'}</span>
                      <span className="text-slate-400 text-sm">#{change.product?.itemId || 'N/A'}</span>
                      {getChangeTypeBadge(change.changeType)}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(change.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Store className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">Store:</span>
                      <span className="font-medium">{change.store?.name || 'Unknown Store'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-600">Quantity:</span>
                      <span className="font-medium ml-2">{change.qty} units</span>
                    </div>
                  </div>

                  {(change.newCost !== null || change.newPrice !== null) && (
                    <div className="bg-slate-50 rounded p-2 mb-3 text-sm">
                      <span className="text-slate-600">Price Changes: </span>
                      {change.newCost !== null && (
                        <span className="mr-3">Cost: {formatCurrency(change.newCost)}</span>
                      )}
                      {change.newPrice !== null && (
                        <span>Price: {formatCurrency(change.newPrice)}</span>
                      )}
                    </div>
                  )}

                  {change.reason && (
                    <p className="text-sm text-slate-600 mb-3 italic">
                      Reason: {change.reason}
                    </p>
                  )}

                  {change.requestedBy && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                      <User className="w-3 h-3" />
                      Requested by: {change.requestedBy}
                    </div>
                  )}

                  {/* Actions */}
                  {showRejectInput === change.id ? (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Input
                        ref={rejectInputRef}
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleReject(change)
                          if (e.key === 'Escape') {
                            setShowRejectInput(null)
                            setRejectReason('')
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(change)}
                        disabled={processingId === change.id}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowRejectInput(null)
                          setRejectReason('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                        onClick={() => setShowRejectInput(change.id)}
                        disabled={processingId === change.id}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 ml-auto"
                        onClick={() => handleApprove(change)}
                        disabled={processingId === change.id}
                      >
                        {processingId === change.id ? (
                          <>
                            <Clock className="w-4 h-4 mr-1 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button variant="outline" className="px-8" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

