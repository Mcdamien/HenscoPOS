'use client'

import { useState, useEffect } from 'react'
import { X, Package, Check, XCircle, Clock, Truck, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface TransferItem {
  id: string
  itemName: string
  qty: number
}

interface Transfer {
  id: string
  transferId: number
  fromStore: string | null
  toStore: string
  status: string
  createdAt: string
  items: TransferItem[]
}

interface TransferConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
  currentStore: string
  transfers: Transfer[]
}

export default function TransferConfirmationModal({ 
  isOpen, 
  onClose, 
  onRefresh,
  currentStore,
  transfers 
}: TransferConfirmationModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [localTransfers, setLocalTransfers] = useState<Transfer[]>(transfers)

  // Update local state when transfers prop changes
  useEffect(() => {
    setLocalTransfers(transfers)
  }, [transfers])

  const handleConfirm = async (transfer: Transfer) => {
    console.log('=== CONFIRM BUTTON CLICKED ===')
    console.log('Transfer ID being sent:', transfer.transferId)
    console.log('Transfer database ID:', transfer.id)

    setProcessingId(transfer.id)

    try {
      console.log('Sending API request with transferId:', transfer.transferId)
      const response = await fetch('/api/transfer/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: transfer.transferId,
          confirmedBy: currentStore,
          confirmedAt: new Date().toISOString() // Include the confirmedAt field
        })
      })

      console.log('API Response status:', response.status)

      const result = await response.json()
      console.log('API Response data:', result)

      if (response.ok) {
        toast.success(`Transfer #${transfer.transferId} confirmed successfully!`)
        setLocalTransfers(prev => prev.filter(t => t.id !== transfer.id))
        onRefresh()
      } else {
        console.error('API Error:', result.error)
        toast.error(result.error || 'Failed to confirm transfer')
      }
    } catch (error) {
      console.error('Network error during confirmation:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (transfer: Transfer) => {
    console.log('=== CANCEL BUTTON CLICKED ===')
    console.log('Transfer ID being cancelled:', transfer.transferId)
    
    if (!confirm(`Are you sure you want to cancel transfer #${transfer.transferId}?`)) {
      return
    }

    setProcessingId(transfer.id)
    
    try {
      console.log('Sending cancel API request with transferId:', transfer.transferId)
      const response = await fetch('/api/transfer/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: transfer.transferId,
          reason: 'Cancelled by store',
          cancelledBy: currentStore
        })
      })

      console.log('Cancel API Response status:', response.status)
      
      const result = await response.json()
      console.log('Cancel API Response data:', result)

      if (response.ok) {
        toast.success(`Transfer #${transfer.transferId} has been cancelled`)
        setLocalTransfers(prev => prev.filter(t => t.id !== transfer.id))
        onRefresh()
      } else {
        console.error('Cancel API Error:', result.error)
        toast.error(result.error || 'Failed to cancel transfer')
      }
    } catch (error) {
      console.error('Network error during cancellation:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Group transfers by ID for display
  const getTotalItems = (items: TransferItem[]) => {
    return items.reduce((sum, item) => sum + item.qty, 0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            Pending Stock Transfers
            <Badge variant="secondary" className="ml-2">
              {localTransfers.length} pending
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {localTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 font-medium text-lg">All caught up!</p>
              <p className="text-sm text-slate-500">No pending transfers to confirm</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localTransfers.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className="border rounded-xl p-5 bg-white hover:border-amber-200 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">Transfer #{transfer.transferId}</span>
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] px-2 py-0">
                            <Clock className="w-3 h-3 mr-1" />
                            PENDING
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Created on {formatDate(transfer.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source</p>
                      <p className="font-bold text-slate-700">{transfer.fromStore || 'Warehouse'}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Destination</p>
                      <p className="font-bold text-emerald-700">{transfer.toStore}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border rounded-lg overflow-hidden mb-4 shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs font-bold text-slate-500">ITEM NAME</TableHead>
                          <TableHead className="text-right w-32 text-xs font-bold text-slate-500">QUANTITY</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfer.items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-700">{item.itemName}</TableCell>
                            <TableCell className="text-right font-black text-slate-900">
                              {item.qty} units
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {transfer.items.length} items | {getTotalItems(transfer.items)} total units
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleCancel(transfer)}
                        disabled={processingId === transfer.id}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4 shadow-sm"
                        onClick={() => handleConfirm(transfer)}
                        disabled={processingId === transfer.id}
                      >
                        {processingId === transfer.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Confirm Receipt
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm font-medium text-slate-500">
              {localTransfers.length} transfer{localTransfers.length !== 1 ? 's' : ''} awaiting confirmation
            </div>
            <Button variant="outline" onClick={onClose} className="px-6">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

