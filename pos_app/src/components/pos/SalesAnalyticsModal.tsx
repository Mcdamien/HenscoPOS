'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, TrendingUp, Calendar, CalendarDays, Store, BarChart3, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface StoreSales {
  storeId: string
  storeName: string
  daily: number
  dailyCount: number
  weekly: number
  monthly: number
  allTime: number
  allTimeCount: number
}

interface SalesAnalyticsData {
  overall: {
    daily: number
    dailyCount: number
    weekly: number
    monthly: number
    allTime: number
    allTimeCount: number
  }
  byStore: StoreSales[]
}

interface SalesAnalyticsModalProps {
  isOpen: boolean
  onClose: () => void
  embedded?: boolean
}

export default function SalesAnalyticsModal({ isOpen, onClose, embedded = false }: SalesAnalyticsModalProps) {
  const [data, setData] = useState<SalesAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalWidth, setModalWidth] = useState(0)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Set initial width to viewport width on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModalWidth(window.innerWidth - 40)
    }
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports/sales')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics()
    }
  }, [isOpen])

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    
    const startX = e.clientX
    const startWidth = modalWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(800, Math.min(startWidth + diff, window.innerWidth - 20))
      setModalWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [modalWidth])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const StatCard = ({ title, amount, count, icon: Icon, color }: any) => (
    <Card className={`overflow-hidden border-none shadow-sm relative group hover:shadow-md transition-all duration-300`}>
      <div className={`absolute top-0 left-0 w-full h-1 ${color}`} />
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(amount)}</p>
            {count !== undefined && (
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold text-[10px] px-1.5 py-0">
                  {count} TXNS
                </Badge>
              </div>
            )}
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const content = (
    <div className="space-y-10 p-8 bg-slate-50/50">
      {/* Overall Stats */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            Global Performance Summary
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Today's Volume" 
            amount={data?.overall.daily || 0} 
            count={data?.overall.dailyCount}
            icon={Calendar} 
            color="bg-emerald-500"
          />
          <StatCard 
            title="Weekly Revenue" 
            amount={data?.overall.weekly || 0} 
            icon={CalendarDays} 
            color="bg-blue-500"
          />
          <StatCard 
            title="Monthly Target" 
            amount={data?.overall.monthly || 0} 
            icon={BarChart3} 
            color="bg-purple-500"
          />
          <StatCard 
            title="All-Time Total" 
            amount={data?.overall.allTime || 0} 
            count={data?.overall.allTimeCount}
            icon={Store} 
            color="bg-slate-900"
          />
        </div>
      </div>

      {/* Individual Shop Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Store className="w-4 h-4 text-blue-600" />
            </div>
            Store-by-Store Analysis
          </h3>
        </div>
        <Card className="border-none shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="hover:bg-slate-900 border-none">
                <TableHead className="text-slate-300 font-bold uppercase text-[10px] tracking-widest h-12">Store Identity</TableHead>
                <TableHead className="text-right text-slate-300 font-bold uppercase text-[10px] tracking-widest h-12">Today's Sales</TableHead>
                <TableHead className="text-right text-slate-300 font-bold uppercase text-[10px] tracking-widest h-12">Weekly</TableHead>
                <TableHead className="text-right text-slate-300 font-bold uppercase text-[10px] tracking-widest h-12">Monthly</TableHead>
                <TableHead className="text-right text-slate-300 font-bold uppercase text-[10px] tracking-widest h-12">Total Life-Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {data?.byStore.map((store) => (
                <TableRow key={store.storeId} className="group hover:bg-slate-50 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{store.storeName}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-tighter uppercase">STORE ID: {store.storeId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-emerald-600">{formatCurrency(store.daily)}</span>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[9px] px-1 py-0 border-none">
                        {store.dailyCount} SALES
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-700 py-4">{formatCurrency(store.weekly)}</TableCell>
                  <TableCell className="text-right font-bold text-slate-700 py-4">{formatCurrency(store.monthly)}</TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-slate-900">{formatCurrency(store.allTime)}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{store.allTimeCount} TOTAL TXNS</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )

  if (embedded) {
    if (loading) return <div className="py-20 text-center text-slate-500">Loading analytics data...</div>
    if (!data) return <div className="py-20 text-center text-red-500">Failed to load analytics data.</div>
    return content
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 rounded-lg flex flex-col p-0 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out"
        style={{ 
          width: modalWidth || 'calc(100vw - 40px)', 
          height: '95vh',
          maxWidth: 'none'
        }}
      >
        {/* Resize Handle */}
        <div 
          ref={resizeRef}
          onMouseDown={startResizing}
          className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-emerald-500/20 transition-colors z-50 flex items-center justify-center ${isResizing ? 'bg-emerald-500/30' : ''}`}
          style={{ right: '-12px' }}
        >
          <div className="w-1.5 h-12 bg-slate-300 rounded-full hover:bg-emerald-500 transition-colors" />
        </div>

        <DialogHeader className="p-6 border-b border-slate-100 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Sales Performance Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading analytics data...</div>
          ) : !data ? (
            <div className="py-20 text-center text-red-500">Failed to load analytics data.</div>
          ) : content}
        </div>
      </DialogContent>
    </Dialog>
  )
}

