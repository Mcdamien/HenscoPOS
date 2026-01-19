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
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
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
  const isMobile = useIsMobile()
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
      <DialogContent className={cn(
        "flex flex-col p-0 overflow-hidden",
        isMobile ? "w-full h-full max-w-none rounded-none" : "max-w-4xl h-[80vh]"
      )}>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="w-5 h-5 text-amber-500" />
            Stock Approvals
            <Badge variant="secondary" className="ml-2">
              {changes.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30">
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              Loading...
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {changes.map((change) => (
                <div 
                  key={change.id} 
                  className="border rounded-xl p-4 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800">{change.product?.name || 'Unknown'}</span>
                      <span className="text-slate-400 text-[10px] font-mono">#{change.product?.itemId || 'N/A'}</span>
                      {getChangeTypeBadge(change.changeType)}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">
                      {formatDate(change.createdAt)}
                    </span>
                  </div>

                  <div className={cn(
                    "grid gap-3 mb-4",
                    isMobile ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg">
                      <Store className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 font-medium">Store:</span>
                      <span className="font-bold text-slate-700">{change.store?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 font-medium">Qty:</span>
                      <span className="font-bold text-slate-700">{change.qty} units</span>
                    </div>
                  </div>

                  {(change.newCost !== null || change.newPrice !== null) && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-4 text-xs">
                      <div className="font-bold text-blue-800 mb-1 uppercase tracking-tight">Price Updates</div>
                      <div className="flex gap-4">
                        {change.newCost !== null && (
                          <div className="flex flex-col">
                            <span className="text-slate-500">New Cost</span>
                            <span className="font-bold text-slate-900">{formatCurrency(change.newCost)}</span>
                          </div>
                        )}
                        {change.newPrice !== null && (
                          <div className="flex flex-col">
                            <span className="text-slate-500">New Price</span>
                            <span className="font-bold text-slate-900">{formatCurrency(change.newPrice)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {change.reason && (
                    <div className="bg-amber-50/30 border border-amber-100 rounded-lg p-3 mb-4">
                      <p className="text-xs text-slate-600 italic leading-relaxed">
                        <span className="font-bold text-amber-800 not-italic mr-1 text-[10px] uppercase">REASON:</span>
                        {change.reason}
                      </p>
                    </div>
                  )}

                  {change.requestedBy && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-tighter">
                      <User className="w-3 h-3" />
                      Requested by: <span className="text-slate-600">{change.requestedBy}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-slate-100">
                    <Button
                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 font-bold"
                      onClick={() => handleApprove(change)}
                      disabled={processingId !== null}
                    >
                      {processingId === change.id ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                      onClick={() => setShowRejectInput(change.id)}
                      disabled={processingId !== null}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>

                  {showRejectInput === change.id && (
                    <div className="mt-4 p-4 bg-red-50/50 rounded-xl border border-red-100 space-y-3">
                      <Label className="text-[10px] font-bold text-red-800 uppercase">Reason for Rejection</Label>
                      <Input
                        ref={rejectInputRef}
                        placeholder="Type reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="bg-white"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700 h-9 text-xs font-bold"
                          onClick={() => handleReject(change)}
                          disabled={processingId === change.id}
                        >
                          Confirm Rejection
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 text-xs font-bold"
                          onClick={() => {
                            setShowRejectInput(null)
                            setRejectReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button variant="outline" className="px-8 font-bold" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

