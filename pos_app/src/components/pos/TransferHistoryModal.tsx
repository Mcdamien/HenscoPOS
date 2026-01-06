'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Package, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDateDDMMYYYY } from '@/lib/utils'

interface TransferHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  expandTransferId?: string | null
  onRefresh?: () => void
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

interface TransferItem {
  id: string
  itemName: string
  qty: number
}

export default function TransferHistoryModal({ isOpen, onClose, expandTransferId, onRefresh }: TransferHistoryModalProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchTransfers()
    }
  }, [isOpen])

  useEffect(() => {
    if (expandTransferId && transfers.length > 0) {
      setExpandedIds(prev => new Set([...prev, expandTransferId]))
    }
  }, [expandTransferId, transfers])

  const fetchTransfers = async () => {
    try {
      const response = await fetch('/api/transfer')
      if (response.ok) {
        const data = await response.json()
        setTransfers(data)
      }
    } catch (error) {
      console.error('Failed to fetch transfers:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  // Get status badge with icon
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200'
    }
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled'
    }
    const icons: Record<string, any> = {
      pending: Clock,
      confirmed: CheckCircle,
      cancelled: XCircle
    }
    
    const Icon = icons[status] || Clock
    return (
      <Badge className={`${styles[status] || 'bg-slate-100 text-slate-700'} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Stock Transfer History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading transfers...</div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No transfers found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Transfer ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const isExpanded = expandedIds.has(transfer.id)
                  return (
                    <React.Fragment key={transfer.id}>
                      <TableRow key={transfer.id} className="cursor-pointer hover:bg-slate-50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleExpand(transfer.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">#TR-{transfer.transferId}</TableCell>
                        <TableCell>{formatDateDDMMYYYY(transfer.createdAt)}</TableCell>
                        <TableCell>
                          {transfer.fromStore || 'Warehouse'}
                        </TableCell>
                        <TableCell className="font-medium">{transfer.toStore}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50">
                            {transfer.items.length} item{transfer.items.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {getStatusBadge(transfer.status)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${transfer.id}-details`}>
                          <TableCell colSpan={7} className="bg-slate-50 py-4">
                            <div className="pl-8">
                              <h4 className="text-sm font-semibold mb-3">Transfer Items</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
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
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50 flex-shrink-0 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} found
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
