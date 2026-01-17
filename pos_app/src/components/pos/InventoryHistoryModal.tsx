'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar, Hash, Package, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
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
import { formatDateDDMMYYYY } from '@/lib/utils'

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
  const [additions, setAdditions] = useState<InventoryAddition[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // Auto-expand the initial row when modal opens
  useEffect(() => {
    if (isOpen && initialExpandedId) {
      setExpandedRows(prev => ({
        ...prev,
        [initialExpandedId]: true
      }))
    }
  }, [isOpen, initialExpandedId])

  useEffect(() => {
    if (isOpen) {
      fetchAdditions()
    }
  }, [isOpen])

  const fetchAdditions = async () => {
    try {
      const response = await fetch('/api/inventory/addition')
      if (response.ok) {
        const data = await response.json()
        setAdditions(data)
      }
    } catch (error) {
      console.error('Failed to fetch inventory additions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const formatDate = (dateString: string) => {
    return formatDateDDMMYYYY(dateString)
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Inventory Addition History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading history...</div>
          ) : additions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No inventory records found</div>
          ) : (
            <div className="space-y-6">
              {additions.map((addition) => (
                <div key={addition.id} className="border rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="bg-slate-100 px-4 py-3 flex items-center justify-between border-b">
                    <div className="flex items-center gap-6">
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
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex items-center gap-1 hover:bg-white"
                        onClick={() => toggleExpand(addition.id)}
                      >
                        <Package className="w-3 h-3 text-slate-400" />
                        {addition.items.length} {addition.items.length === 1 ? 'item' : 'items'}
                        {expandedRows[addition.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                        Completed
                      </Badge>
                    </div>
                  </div>
                  {expandedRows[addition.id] && (
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
