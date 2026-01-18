'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Package, Clock, CheckCircle, XCircle } from 'lucide-react'
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
import { formatDateDDMMYYYY } from '@/lib/utils'
import { useTransfers, useTransferItems } from '@/hooks/useOfflineData'
import { dexieDb } from '@/lib/dexie'
import { useLiveQuery } from 'dexie-react-hooks'

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const transfers = useLiveQuery(async () => {
    const ts = await dexieDb.stockTransfers.reverse().sortBy('updatedAt')
    const results = await Promise.all(ts.map(async (t) => {
      const items = await dexieDb.stockTransferItems.where('stockTransferId').equals(t.id).toArray()
      return { ...t, items }
    }))
    return results
  }) || []

  const loading = false

  useEffect(() => {
    if (expandTransferId && transfers.length > 0) {
      setExpandedIds(prev => new Set([...prev, expandTransferId]))
    }
  }, [expandTransferId, transfers.length])

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
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="w-6 h-6 text-emerald-600" />
            Stock Transfer History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-4"></div>
              <p>Fetching transfer history...</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <Package className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No transfers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</TableHead>
                  <TableHead className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const isExpanded = expandedIds.has(transfer.id)
                  return (
                    <React.Fragment key={transfer.id}>
                      <TableRow key={transfer.id} className="cursor-pointer hover:bg-slate-50/50 group">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 group-hover:text-emerald-600 transition-colors"
                            onClick={() => toggleExpand(transfer.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">#TR-{transfer.transferId}</TableCell>
                        <TableCell className="text-slate-500 font-medium">{formatDateDDMMYYYY(transfer.createdAt)}</TableCell>
                        <TableCell className="font-medium text-slate-600">
                          {transfer.fromStore || 'Warehouse'}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700">{transfer.toStore}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px]">
                            {transfer.items.length} ITEM{transfer.items.length !== 1 ? 'S' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {getStatusBadge(transfer.status)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${transfer.id}-details`}>
                          <TableCell colSpan={7} className="bg-slate-50/50 p-0 border-b">
                            <div className="px-12 py-6 border-l-4 border-emerald-500 bg-white shadow-inner">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                                  Detailed Transfer Breakdown
                                </h4>
                              </div>
                              <div className="border rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                  <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-slate-900 border-none">
                                      <TableHead className="text-slate-300 font-bold uppercase text-[10px] tracking-widest h-10">Product Name</TableHead>
                                      <TableHead className="text-right text-slate-300 font-bold uppercase text-[10px] tracking-widest h-10 w-32">Qty Transferred</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {transfer.items.map((item) => (
                                      <TableRow key={item.id} className="hover:bg-slate-50">
                                        <TableCell className="font-bold text-slate-700">{item.itemName}</TableCell>
                                        <TableCell className="text-right font-black text-slate-900 bg-slate-50/30">
                                          {item.qty} units
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
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

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm font-medium text-slate-500">
              <span className="text-slate-900 font-bold">{transfers.length}</span> total transfers recorded
            </div>
            <Button variant="outline" onClick={onClose} className="px-8 font-bold">
              Close History
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
