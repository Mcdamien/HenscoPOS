'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, TrendingUp, Calendar, CalendarDays, Store, BarChart3, ChevronRight, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

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
  const isMobile = useIsMobile()
  const [data, setData] = useState<SalesAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalWidth, setModalWidth] = useState(0)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Set initial width to viewport width on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModalWidth(isMobile ? window.innerWidth : window.innerWidth - 40)
    }
  }, [isMobile])

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
    if (isMobile) return
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
  }, [modalWidth, isMobile])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const StatCard = ({ title, amount, count, icon: Icon, color }: any) => (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm relative group hover:shadow-md transition-all duration-300",
      isMobile && "shadow-none border bg-white"
    )}>
      <div className={cn("absolute top-0 left-0 w-full h-1", color)} />
      <CardContent className={cn("p-6", isMobile && "p-4")}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className={cn("font-black text-slate-900", isMobile ? "text-xl" : "text-2xl")}>{formatCurrency(amount)}</p>
            {count !== undefined && (
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold text-[10px] px-1.5 py-0">
                  {count} TXNS
                </Badge>
              </div>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors",
            isMobile && "p-2 rounded-xl"
          )}>
            <Icon className={cn("w-6 h-6", isMobile && "w-5 h-5")} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const content = (
    <div className={cn("space-y-10 p-8 bg-slate-50/50", isMobile && "space-y-6 p-4")}>
      {/* Overall Stats */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            {isMobile ? "Global Summary" : "Global Performance Summary"}
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
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Store className="w-4 h-4 text-blue-600" />
            </div>
            {isMobile ? "Store Analysis" : "Store-by-Store Analysis"}
          </h3>
        </div>
        {isMobile ? (
          <div className="space-y-4">
            {data?.byStore.map((store) => (
              <Card key={store.storeId} className="border-none shadow-sm overflow-hidden bg-white p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{store.storeName}</p>
                      <p className="text-[10px] text-slate-400 font-bold tracking-tighter uppercase">STORE ID: {store.storeId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-600 block">{formatCurrency(store.daily)}</span>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[9px] px-1 py-0 border-none">
                      {store.dailyCount} SALES TODAY
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Weekly</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(store.weekly)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Monthly</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(store.monthly)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">All-Time</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(store.allTime)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )

  if (embedded) {
    if (loading) return <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-sm font-medium">Loading analytics...</p>
    </div>
    if (!data) return <div className="py-20 text-center text-red-500 font-medium">Failed to load analytics data.</div>
    return content
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 rounded-xl flex flex-col p-0 overflow-hidden",
          isMobile && "h-full max-h-screen w-full rounded-none"
        )}
        style={{ 
          width: isMobile ? '100vw' : (modalWidth || 'calc(100vw - 40px)'), 
          height: isMobile ? '100vh' : '95vh',
          maxWidth: 'none'
        }}
      >
        {/* Resize Handle - Hide on Mobile */}
        {!isMobile && (
          <div 
            ref={resizeRef}
            onMouseDown={startResizing}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-emerald-500/20 transition-colors z-50 flex items-center justify-center",
              isResizing ? "bg-emerald-500/30" : ""
            )}
            style={{ right: '-12px' }}
          >
            <div className="w-1.5 h-12 bg-slate-300 rounded-full hover:bg-emerald-500 transition-colors" />
          </div>
        )}

        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
              {isMobile ? "Sales Analytics" : "Sales Performance Analytics"}
            </DialogTitle>
            {!isMobile && (
              <div className="text-xs font-medium text-slate-400 mr-8">
                Viewport: {modalWidth ? Math.round(modalWidth) : 'Auto'}px
              </div>
            )}
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
              <p>Fetching analytics data...</p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-red-500">
              <p>Failed to load analytics data.</p>
              <Button variant="outline" size="sm" onClick={fetchAnalytics} className="mt-4">
                Retry
              </Button>
            </div>
          ) : content}
        </div>

        <DialogFooter className={cn("px-6 py-4 border-t bg-white shrink-0", isMobile && "p-4")}>
          <div className="flex items-center justify-between w-full">
            {!isMobile && (
              <div className="text-sm font-medium text-slate-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            )}
            <Button 
              variant={isMobile ? "default" : "outline"} 
              onClick={onClose} 
              className={cn("px-6 h-10 font-bold", isMobile && "w-full bg-slate-900")}
            >
              {isMobile ? "Close Analytics" : "Close Analytics"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

