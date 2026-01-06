'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, FileText, TrendingUp, BarChart3, PieChart, Download, GripVertical } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SalesReportModal from './SalesReportModal'
import SalesAnalyticsModal from './SalesAnalyticsModal'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  transactions: any[]
}

export default function ReportModal({ isOpen, onClose, transactions }: ReportModalProps) {
  const [activeTab, setActiveTab] = useState('sales-report')
  const [modalWidth, setModalWidth] = useState(0)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Set initial width to viewport width on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModalWidth(window.innerWidth - 40)
    }
  }, [])

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

        <DialogHeader className="p-6 border-b border-slate-100 flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Reporting & Analytics Center
          </DialogTitle>
          <div className="flex items-center gap-2 mr-8">
            <span className="text-xs text-slate-400">{modalWidth ? Math.round(modalWidth) : 'Auto'}px</span>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-60 bg-slate-50 border-r border-slate-100 p-4 flex flex-col gap-2 shrink-0">
            <div className="px-3 mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reports & Analytics</h4>
            </div>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'analytics' 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' 
                  : 'text-slate-600 hover:bg-white hover:text-emerald-600'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Sales Analytics
            </button>
            <button
              onClick={() => setActiveTab('sales-report')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'sales-report' 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' 
                  : 'text-slate-600 hover:bg-white hover:text-emerald-600'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Detailed Sales
            </button>
            <div className="mt-auto pt-6 border-t border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-3">Module Roadmap</p>
              <button disabled className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed w-full text-left opacity-60">
                <PieChart className="w-5 h-5" />
                Inventory Value
              </button>
            </div>
          </div>

          {/* Main Report Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {activeTab === 'analytics' && (
              <div className="p-0">
                 <SalesAnalyticsContent />
              </div>
            )}
            {activeTab === 'sales-report' && (
              <div className="p-0">
                <SalesReportContent transactions={transactions} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Internal content components to avoid dialog-in-dialog nesting issues
function SalesAnalyticsContent() {
  return <SalesAnalyticsModal isOpen={true} onClose={() => {}} embedded={true} />
}

function SalesReportContent({ transactions }: { transactions: any[] }) {
  return <SalesReportModal isOpen={true} onClose={() => {}} transactions={transactions} embedded={true} />
}

