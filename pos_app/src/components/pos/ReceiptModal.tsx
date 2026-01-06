'use client'

import { X, Printer, Eye } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  id: number
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
  const printButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        printButtonRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Print preview mode - modal shows receipt without auto-printing
  // User can click Print button to open print dialog, or Close to dismiss

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
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b bg-slate-50/50 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4 text-emerald-600" />
            Print Preview - Transaction Receipt
          </DialogTitle>
        </DialogHeader>
        
        {/* Scrollable receipt content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="font-mono receipt-content bg-white p-4 border rounded-lg shadow-sm">
            {/* Header - Uses Arnel Rounded equivalent (Quicksand) */}
            <div className="text-center mb-4 border-b-2 border-dashed border-slate-200 pb-4 font-[var(--font-quicksand)]">
              <h2 className="text-xl font-bold text-emerald-600 mb-1 tracking-tight">HENSCO LTD</h2>
              <p className="font-bold text-slate-800 uppercase text-xs tracking-widest">{transaction.store}</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase">Official Transaction Receipt</p>
              <div className="text-[10px] text-slate-500 mt-3 space-y-0.5">
                <p>REF: #TXN-{transaction.id.toString().padStart(6, '0')}</p>
                <p>DATE: {formatDateDDMMYYYY(transaction.date)} @ {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Items - Uses Geo Sans Light equivalent (Nunito) */}
            <div className="space-y-2 mb-4 font-[var(--font-nunito)]">
              {transaction.items.map((item, index) => (
                <div key={index} className="flex justify-between text-xs items-start">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{item.itemName}</p>
                    <p className="text-slate-400">{item.qty} x {formatCurrency(item.itemPrice)}</p>
                  </div>
                  <p className="font-bold text-slate-800 ml-4">
                    {formatCurrency(item.itemPrice * item.qty)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals - Uses Geo Sans Light equivalent (Nunito) */}
            <div className="pt-4 border-t-2 border-dashed border-slate-200 space-y-1.5 font-[var(--font-nunito)]">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Subtotal</span>
                <span>{formatCurrency(transaction.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>VAT (12.5%)</span>
                <span>{formatCurrency(transaction.tax)}</span>
              </div>
              <div className="flex justify-between text-base font-black mt-2 pt-2 border-t border-slate-100">
                <span className="text-slate-900">TOTAL</span>
                <span className="text-emerald-600">{formatCurrency(transaction.total)}</span>
              </div>
            </div>

            {/* Footer - Uses Chopin equivalent (Playfair Display) */}
            <div className="text-center mt-6 pt-4 border-t border-slate-100 font-[var(--font-playfair)]">
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Thank you for your business!</p>
              <p className="text-[8px] text-slate-300 mt-2 uppercase tracking-tighter italic">Goods sold are non-returnable unless defective.</p>
            </div>
          </div>
        </div>

        {/* Fixed action buttons - always visible */}
        <div className="p-6 pt-4 border-t bg-white flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              ref={printButtonRef}
              onClick={handlePrint} 
              className="bg-emerald-600 hover:bg-emerald-700 h-11 font-bold shadow-md shadow-emerald-100"
            >
              <Printer className="w-4 h-4 mr-2" />
              PRINT
            </Button>
            <Button variant="outline" onClick={handleClose} className="border-slate-200 h-11 font-bold text-slate-600 hover:bg-slate-50">
              <X className="w-4 h-4 mr-2" />
              CLOSE
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
