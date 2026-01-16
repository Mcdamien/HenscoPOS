'use client'

import { useState, useEffect } from 'react'
import { X, Package, Check, XCircle, Clock, Truck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            Pending Stock Transfers
            <Badge variant="secondary" className="ml-2">
              {localTransfers.length} pending
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {localTransfers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-sm text-slate-500">No pending transfers to confirm</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localTransfers.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-500" />
                      <span className="font-medium">Transfer #{transfer.transferId}</span>
                      <Badge className="bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Confirmation
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(transfer.createdAt)}
                    </span>
                  </div>

                  <div className="text-sm mb-3">
                    <span className="text-slate-600">From: </span>
                    <span className="font-medium">{transfer.fromStore || 'Warehouse'}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="text-slate-600">To: </span>
                    <span className="font-medium">{transfer.toStore}</span>
                  </div>

                  {/* Items Table */}
                  <div className="border rounded-md overflow-hidden mb-3">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right w-24">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfer.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell className="text-right font-medium">
                              {item.qty} units
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="text-xs text-slate-500 mb-3">
                    Total Items: <span className="font-medium">{transfer.items.length}</span> | 
                    Total Units: <span className="font-medium">{getTotalItems(transfer.items)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                      onClick={() => handleCancel(transfer)}
                      disabled={processingId === transfer.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel Transfer
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 ml-auto"
                      onClick={() => handleConfirm(transfer)}
                      disabled={processingId === transfer.id}
                    >
                      {processingId === transfer.id ? (
                        <>
                          <Clock className="w-4 h-4 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Confirm Receipt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50 flex-shrink-0 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {localTransfers.length} transfer{localTransfers.length !== 1 ? 's' : ''} awaiting confirmation
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

