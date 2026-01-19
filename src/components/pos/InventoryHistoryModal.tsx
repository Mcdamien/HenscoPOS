'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar, Hash, Package, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

import { useAdditions } from '@/hooks/useOfflineData'

interface InventoryAdditionItem {
  id: string
  itemName: string
  qty: number
  cost: number
  price: number
}

interface InventoryAddition {
  id: string
  additionId: number
  referenceId: string | null
  totalCost: number
  createdAt: string
  items: InventoryAdditionItem[]
}

interface InventoryHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  initialExpandedId?: string | null
}

export default function InventoryHistoryModal({ isOpen, onClose, initialExpandedId = null }: InventoryHistoryModalProps) {
  const isMobile = useIsMobile()
  const additions = useAdditions() || []
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const loading = !additions && isOpen

  // Auto-expand the initial row when modal opens
  useEffect(() => {
    if (isOpen && initialExpandedId) {
      setExpandedRows(prev => ({
        ...prev,
        [initialExpandedId]: true
      }))
    }
  }, [isOpen, initialExpandedId])

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden transition-all duration-300",
        isMobile && "max-w-none w-full h-full rounded-none"
      )}>
        <DialogHeader className="px-4 py-4 md:px-6 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Inventory Addition History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading history...</div>
          ) : additions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No inventory records found</div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {additions.map((addition) => (
                <div key={addition.id} className="border rounded-xl overflow-hidden bg-slate-50/50">
                  <div className={cn(
                    "bg-slate-100 px-4 py-3 flex items-center justify-between border-b",
                    isMobile && "flex-col items-start gap-3"
                  )}>
                    <div className={cn(
                      "flex items-center gap-4 md:gap-6",
                      isMobile && "flex-col items-start gap-1 w-full"
                    )}>
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-700">#INV-{addition.additionId}</span>
                        {addition.referenceId && (
                          <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border">
                            Ref: {addition.referenceId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        {formatDate(addition.createdAt)}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                        <DollarSign className="w-4 h-4" />
                        Total Cost: {formatCurrency(addition.totalCost)}
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-3",
                      isMobile && "w-full justify-between pt-2 border-t border-slate-200 mt-1"
                    )}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex items-center gap-1 hover:bg-white px-2"
                        onClick={() => toggleExpand(addition.id)}
                      >
                        <Package className="w-3 h-3 text-slate-400" />
                        {addition.items.length} {addition.items.length === 1 ? 'item' : 'items'}
                        {expandedRows[addition.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0 h-6">
                        Completed
                      </Badge>
                    </div>
                  </div>
                  {expandedRows[addition.id] && (
                    <div className="overflow-x-auto">
                      {!isMobile ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-transparent hover:bg-transparent">
                              <TableHead className="h-9 py-0">Item Name</TableHead>
                              <TableHead className="h-9 py-0 text-right">Qty</TableHead>
                              <TableHead className="h-9 py-0 text-right">Cost</TableHead>
                              <TableHead className="h-9 py-0 text-right">Price</TableHead>
                              <TableHead className="h-9 py-0 text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {addition.items.map((item) => (
                              <TableRow key={item.id} className="hover:bg-transparent">
                                <TableCell className="py-2 flex items-center gap-2">
                                  <Package className="w-3 h-3 text-slate-400" />
                                  {item.itemName}
                                </TableCell>
                                <TableCell className="py-2 text-right">{item.qty}</TableCell>
                                <TableCell className="py-2 text-right">{formatCurrency(item.cost)}</TableCell>
                                <TableCell className="py-2 text-right">{formatCurrency(item.price)}</TableCell>
                                <TableCell className="py-2 text-right font-medium">{formatCurrency(item.cost * item.qty)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-3 space-y-3 bg-white">
                          {addition.items.map((item) => (
                            <div key={item.id} className="p-3 border rounded-lg bg-slate-50/50 space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-slate-800 flex items-center gap-2 text-sm">
                                  <Package className="w-3.5 h-3.5 text-slate-400" />
                                  {item.itemName}
                                </span>
                                <Badge variant="outline" className="bg-white text-[10px] h-5 px-1.5">
                                  Qty: {item.qty}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                  <span className="text-slate-500">Cost:</span>
                                  <span className="font-medium">{formatCurrency(item.cost)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                  <span className="text-slate-500">Price:</span>
                                  <span className="font-medium">{formatCurrency(item.price)}</span>
                                </div>
                                <div className="flex justify-between pt-1 col-span-2">
                                  <span className="text-slate-500">Subtotal:</span>
                                  <span className="font-bold text-emerald-600">{formatCurrency(item.cost * item.qty)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-4 md:px-6 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button variant="outline" className="px-8 w-full md:w-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
