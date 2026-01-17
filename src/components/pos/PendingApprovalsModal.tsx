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

interface PendingChange {
  id: string
  productId: string
  storeId: string
  product: {
    id: string
    itemId: number
    name: string
  }
  store: {
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
  createdAt: string
}

interface PendingApprovalsModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function PendingApprovalsModal({ isOpen, onClose, onRefresh }: PendingApprovalsModalProps) {
  const [changes, setChanges] = useState<PendingChange[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null)
  const rejectInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showRejectInput && rejectInputRef.current) {
      rejectInputRef.current.focus()
    }
  }, [showRejectInput])

  const fetchPendingChanges = async () => {
    try {
      const response = await fetch('/api/inventory/pending-changes?status=pending')
      if (response.ok) {
        const data = await response.json()
        setChanges(data.changes)
      }
    } catch (error) {
      console.error('Failed to fetch pending changes:', error)
      toast.error('Failed to load pending changes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchPendingChanges()
    }
  }, [isOpen])

  const handleApprove = async (change: PendingChange) => {
    setProcessingId(change.id)
    try {
      const response = await fetch('/api/inventory/approve-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingChangeId: change.id,
          reviewedBy: 'Warehouse Manager'
        })
      })

      if (response.ok) {
        toast.success(`Approved: ${change.product.name} for ${change.store.name}`)
        fetchPendingChanges()
        onRefresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to approve change')
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
      const response = await fetch('/api/inventory/reject-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingChangeId: change.id,
          reviewedBy: 'Warehouse Manager',
          reason: rejectReason
        })
      })

      if (response.ok) {
        toast.success(`Rejected: ${change.product.name}`)
        setShowRejectInput(null)
        setRejectReason('')
        fetchPendingChanges()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to reject change')
      }
    } catch (error) {
      console.error('Failed to reject change:', error)
      toast.error('Failed to reject change')
    } finally {
      setProcessingId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getChangeTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      add: 'bg-emerald-100 text-emerald-700',
      remove: 'bg-red-100 text-red-700',
      adjust: 'bg-blue-100 text-blue-700',
      return: 'bg-amber-100 text-amber-700'
    }
    const labels: Record<string, string> = {
      add: 'Add',
      remove: 'Remove',
      adjust: 'Adjust',
      return: 'Return'
    }
    return (
      <Badge className={styles[type] || 'bg-slate-100 text-slate-700'}>
        {labels[type] || type}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
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
                      <span className="font-medium">{change.product.name}</span>
                      <span className="text-slate-400 text-sm">#{change.product.itemId}</span>
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
                      <span className="font-medium">{change.store.name}</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

