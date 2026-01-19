'use client'

import { X, Printer, Eye } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateDDMMYYYY } from '@/lib/utils'

interface TransactionItem {
  id: string
  itemName: string
  itemPrice: number
  qty: number
}

interface Transaction {
  id: string
  transactionId: number
  date: string
  store: string
  subtotal: number
  tax: number
  total: number
  items: TransactionItem[]
}

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction
}

export default function ReceiptModal({ isOpen, onClose, transaction }: ReceiptModalProps) {
  const isMobile = useIsMobile()
  const printButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        printButtonRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const dateObj = new Date(transaction.date)

  const handlePrint = () => {
    window.print()
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-md h-[85vh] flex flex-col p-0 overflow-hidden transition-all duration-300",
        isMobile && "max-w-none w-full h-full rounded-none h-screen"
      )}>
        <DialogHeader className="px-4 py-4 md:px-6 border-b bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5 text-emerald-600" />
            Print Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          <div className="font-mono receipt-content bg-white p-6 border rounded-xl shadow-md mx-auto max-w-[320px]">
            <div className="text-center mb-6 border-b-2 border-dashed border-slate-200 pb-6 font-[var(--font-quicksand)]">
              <h2 className="text-2xl font-bold text-emerald-600 mb-1 tracking-tight">Yames POS</h2>
              <p className="font-bold text-slate-800 uppercase text-xs tracking-widest">{transaction.store}</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase">Official Transaction Receipt</p>
              <div className="text-[10px] text-slate-500 mt-4 space-y-1">
                <p className="font-bold">REF: #TXN-{(transaction.transactionId || transaction.id || '').toString().padStart(6, '0')}</p>
                <p>DATE: {formatDateDDMMYYYY(transaction.date)} @ {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 font-[var(--font-nunito)]">
              {transaction.items.map((item, index) => (
                <div key={index} className="flex justify-between text-xs items-start">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-slate-800">{item.itemName}</p>
                    <p className="text-slate-400 text-[10px]">{item.qty} x {formatCurrency(item.itemPrice)}</p>
                  </div>
                  <p className="font-black text-slate-900 ml-auto">
                    {formatCurrency(item.itemPrice * item.qty)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t-2 border-dashed border-slate-200 space-y-2 font-[var(--font-nunito)]">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Subtotal</span>
                <span>{formatCurrency(transaction.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>VAT (12.5%)</span>
                <span>{formatCurrency(transaction.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-black mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-900">TOTAL</span>
                <span className="text-emerald-600">{formatCurrency(transaction.total)}</span>
              </div>
            </div>

            <div className="text-center mt-8 pt-6 border-t border-slate-100 font-[var(--font-playfair)]">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Thank you for your business!</p>
              <p className="text-[9px] text-slate-300 mt-2 uppercase tracking-tighter italic">Goods sold are non-returnable unless defective.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-4 md:px-6 border-t bg-white shrink-0">
          <div className={cn(
            "grid gap-3 w-full",
            isMobile ? "grid-cols-1" : "grid-cols-2"
          )}>
            <Button 
              ref={printButtonRef}
              onClick={handlePrint} 
              className="bg-emerald-600 hover:bg-emerald-700 h-11 md:h-12 font-bold shadow-sm order-1"
            >
              <Printer className="w-4 h-4 mr-2" />
              PRINT RECEIPT
            </Button>
            <Button variant="outline" onClick={handleClose} className="h-11 md:h-12 font-bold text-slate-600 order-2">
              <X className="w-4 h-4 mr-2" />
              CLOSE
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
