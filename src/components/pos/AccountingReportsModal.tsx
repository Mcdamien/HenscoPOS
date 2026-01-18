'use client'

import { useState, useRef } from 'react'
import { FileText, Download, Calendar, TrendingUp, Scale, PieChart, ChevronDown, Loader2, CheckCircle, X, Printer, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type ReportType = 'profit-loss' | 'trial-balance' | 'balance-sheet'

interface AccountingReportsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ReportData {
  profitLoss?: {
    revenue: Array<{ code: string; name: string; balance: number }>
    expenses: Array<{ code: string; name: string; balance: number }>
    summary: {
      totalRevenue: number
      totalExpenses: number
      netProfit: number
      profitMargin: string
    }
    period: { startDate: string; endDate: string }
  }
  trialBalance?: {
    trialBalance: Array<{
      code: string
      name: string
      type: string
      debit: number
      credit: number
      balance: number
    }>
    summary: {
      totalDebits: number
      totalCredits: number
      difference: number
      isBalanced: boolean
    }
    period: { startDate: string; endDate: string }
  }
  balanceSheet?: {
    balanceSheet: {
      assets: {
        current: Array<{ code: string; name: string; balance: number }>
        fixed: Array<{ code: string; name: string; balance: number }>
        totals: {
          currentAssets: number
          fixedAssets: number
          totalAssets: number
        }
      }
      liabilities: {
        current: Array<{ code: string; name: string; balance: number }>
        longTerm: Array<{ code: string; name: string; balance: number }>
        totals: {
          currentLiabilities: number
          longTermLiabilities: number
          totalLiabilities: number
        }
      }
      equity: Array<{ code: string; name: string; balance: number }>
      totals: {
        totalEquity: number
        totalLiabilitiesAndEquity: number
      }
    }
    accountingEquation: {
      assets: number
      liabilities: number
      equity: number
      liabilitiesAndEquity: number
      balance: number
      isBalanced: boolean
    }
    period: { asOfDate: string }
  }
}

const REPORT_CONFIG = {
  'profit-loss': {
    title: 'Profit & Loss Statement',
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Income and expenses for the period'
  },
  'trial-balance': {
    title: 'Trial Balance',
    icon: Scale,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'All account balances (Debits vs Credits)'
  },
  'balance-sheet': {
    title: 'Balance Sheet',
    icon: PieChart,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Assets, Liabilities, and Equity'
  }
}

export default function AccountingReportsModal({ isOpen, onClose }: AccountingReportsModalProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      toast.error('Please select a report type')
      return
    }

    setLoading(true)
    setHasGenerated(false)

    try {
      let endpoint = ''
      const params = new URLSearchParams()
      
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      
      switch (selectedReport) {
        case 'profit-loss':
          endpoint = '/api/reports/accounting/profit-loss'
          break
        case 'trial-balance':
          endpoint = '/api/reports/accounting/trial-balance'
          break
        case 'balance-sheet':
          endpoint = '/api/reports/accounting/balance-sheet'
          break
      }

      const response = await fetch(`${endpoint}?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        // Map selectedReport back to the property names in ReportData interface
        const reportKey = 
          selectedReport === 'profit-loss' ? 'profitLoss' : 
          selectedReport === 'trial-balance' ? 'trialBalance' : 
          'balanceSheet';
        
        setReportData({ [reportKey]: data.data })
        setHasGenerated(true)
        toast.success(`${REPORT_CONFIG[selectedReport].title} generated successfully!`)
      } else {
        toast.error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('An error occurred while generating the report')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    if (!reportData || !selectedReport) return

    const doc = new jsPDF()
    const config = REPORT_CONFIG[selectedReport]
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(config.title, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Date range
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    if (reportData.profitLoss) {
      doc.text(`Period: ${reportData.profitLoss.period.startDate} to ${reportData.profitLoss.period.endDate}`, pageWidth / 2, yPos, { align: 'center' })
    } else if (reportData.trialBalance) {
      doc.text(`Period: ${reportData.trialBalance.period.startDate} to ${reportData.trialBalance.period.endDate}`, pageWidth / 2, yPos, { align: 'center' })
    } else if (reportData.balanceSheet) {
      doc.text(`As of: ${reportData.balanceSheet.period.asOfDate}`, pageWidth / 2, yPos, { align: 'center' })
    }
    yPos += 15

    // Generate content based on report type
    if (selectedReport === 'profit-loss' && reportData.profitLoss) {
      generateProfitLossPDF(doc, reportData.profitLoss, yPos)
    } else if (selectedReport === 'trial-balance' && reportData.trialBalance) {
      generateTrialBalancePDF(doc, reportData.trialBalance, yPos)
    } else if (selectedReport === 'balance-sheet' && reportData.balanceSheet) {
      generateBalanceSheetPDF(doc, reportData.balanceSheet, yPos)
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

    // Save
    doc.save(`${selectedReport}-report-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF downloaded successfully!')
  }

  const handlePrint = () => {
    if (!reportData || !selectedReport) return

    // Create a print-friendly version in a new window
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const config = REPORT_CONFIG[selectedReport]
    const htmlContent = generatePrintHTML()

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print()
      printWindow.close()
    }

    toast.success('Print dialog opened!')
  }

  const handlePreview = () => {
    if (!reportData || !selectedReport) return
    setIsPreviewLoading(true)
    // Small delay for smooth transition
    setTimeout(() => {
      setShowPreview(true)
      setIsPreviewLoading(false)
    }, 100)
  }

  const generatePrintHTML = (): string => {
    if (!reportData || !selectedReport) return ''

    const config = REPORT_CONFIG[selectedReport]
    let content = ''

    if (selectedReport === 'profit-loss' && reportData.profitLoss) {
      content = generateProfitLossHTML(reportData.profitLoss)
    } else if (selectedReport === 'trial-balance' && reportData.trialBalance) {
      content = generateTrialBalanceHTML(reportData.trialBalance)
    } else if (selectedReport === 'balance-sheet' && reportData.balanceSheet) {
      content = generateBalanceSheetHTML(reportData.balanceSheet)
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.title}</title>
          <style>
            /* Thermal Printer Configuration: 80mm x 58mm */
            @page {
              size: 80mm 58mm;
              margin: 0;
            }

            /* Google Fonts via CSS variables for consistent styling */
            @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap');
            
            :root {
              --font-quicksand: 'Quicksand', sans-serif;
              --font-nunito: 'Nunito', sans-serif;
              --font-playfair: 'Playfair Display', serif;
            }
            
            body { 
              font-family: var(--font-nunito); 
              margin: 3mm; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 74mm !important;
            }
            .header { 
              text-align: center; 
              margin-bottom: 10px; 
              font-family: var(--font-quicksand); 
            }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
            .period { font-size: 9px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8px; }
            th, td { border: 1px solid #ddd; padding: 3px 5px; text-align: left; font-size: 8px; }
            th { background-color: #f5f5f5; font-weight: bold; font-size: 7px; }
            .total { font-weight: bold; }
            .revenue { color: #16a34a; }
            .expense { color: #dc2626; }
            .asset { color: #2563eb; }
            .liability { color: #ea580c; }
            .equity { color: #9333ea; }
            h3 { font-family: var(--font-quicksand); margin-top: 10px; font-size: 12px; }
            h4 { font-family: var(--font-nunito); margin-top: 8px; margin-bottom: 5px; font-size: 10px; }
            .footer { 
              font-family: var(--font-playfair); 
              text-align: center; 
              margin-top: 15px; 
              font-style: italic; 
              color: #666; 
              font-size: 7px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${config.title}</div>
            <div class="period">
              ${reportData.profitLoss ? `Period: ${reportData.profitLoss.period.startDate} to ${reportData.profitLoss.period.endDate}` :
                reportData.trialBalance ? `Period: ${reportData.trialBalance.period.startDate} to ${reportData.trialBalance.period.endDate}` :
                reportData.balanceSheet ? `As of: ${reportData.balanceSheet.period.asOfDate}` : ''}
            </div>
          </div>
          ${content}
          <div class="footer">
            Generated on: ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `
  }

  const generateProfitLossHTML = (data: any): string => {
    const revenueRows = data.revenue.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="revenue">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    const expenseRows = data.expenses.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="expense">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    return `
      <h3 style="color: #16a34a;">REVENUE</h3>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${revenueRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Revenue</td><td class="revenue">${formatCurrency(data.summary.totalRevenue)}</td></tr></tfoot>
      </table>

      <h3 style="color: #dc2626;">EXPENSES</h3>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${expenseRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Expenses</td><td class="expense">${formatCurrency(data.summary.totalExpenses)}</td></tr></tfoot>
      </table>

      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Net Profit</div>
            <div class="summary-value" style="color: #059669;">${formatCurrency(data.summary.netProfit)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Profit Margin</div>
            <div class="summary-value">${data.summary.profitMargin}%</div>
          </div>
        </div>
      </div>
    `
  }

  const generateTrialBalanceHTML = (data: any): string => {
    const rows = data.trialBalance.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td>${acc.type}</td><td>${formatCurrency(acc.debit)}</td><td>${formatCurrency(acc.credit)}</td></tr>`
    ).join('')

    return `
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total">
            <td colspan="3">TOTALS</td>
            <td>${formatCurrency(data.summary.totalDebits)}</td>
            <td>${formatCurrency(data.summary.totalCredits)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Difference</div>
            <div class="summary-value" style="color: ${data.summary.isBalanced ? '#059669' : '#dc2626'};">${formatCurrency(data.summary.difference)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Status</div>
            <div class="summary-value" style="color: ${data.summary.isBalanced ? '#059669' : '#dc2626'};">${data.summary.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}</div>
          </div>
        </div>
      </div>
    `
  }

  const generateBalanceSheetHTML = (data: any): string => {
    const currentAssetsRows = data.balanceSheet.assets.current.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="asset">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    const fixedAssetsRows = data.balanceSheet.assets.fixed.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="asset">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    const currentLiabilitiesRows = data.balanceSheet.liabilities.current.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="liability">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    const longTermLiabilitiesRows = data.balanceSheet.liabilities.longTerm.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="liability">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    const equityRows = data.balanceSheet.equity.map((acc: any) =>
      `<tr><td>${acc.code}</td><td>${acc.name}</td><td class="equity">${formatCurrency(acc.balance)}</td></tr>`
    ).join('')

    return `
      <h3 style="color: #2563eb;">ASSETS</h3>

      <h4>Current Assets</h4>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${currentAssetsRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Current Assets</td><td class="asset">${formatCurrency(data.balanceSheet.assets.totals.currentAssets)}</td></tr></tfoot>
      </table>

      <h4>Fixed Assets</h4>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${fixedAssetsRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Fixed Assets</td><td class="asset">${formatCurrency(data.balanceSheet.assets.totals.fixedAssets)}</td></tr></tfoot>
      </table>

      <div style="font-weight: bold; font-size: 16px; margin: 10px 0; color: #2563eb;">
        TOTAL ASSETS: ${formatCurrency(data.balanceSheet.assets.totals.totalAssets)}
      </div>

      <h3 style="color: #ea580c;">LIABILITIES</h3>

      <h4>Current Liabilities</h4>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${currentLiabilitiesRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Current Liabilities</td><td class="liability">${formatCurrency(data.balanceSheet.liabilities.totals.currentLiabilities)}</td></tr></tfoot>
      </table>

      <h4>Long-term Liabilities</h4>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${longTermLiabilitiesRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Long-term Liabilities</td><td class="liability">${formatCurrency(data.balanceSheet.liabilities.totals.longTermLiabilities)}</td></tr></tfoot>
      </table>

      <div style="font-weight: bold; font-size: 16px; margin: 10px 0; color: #ea580c;">
        TOTAL LIABILITIES: ${formatCurrency(data.balanceSheet.liabilities.totals.totalLiabilities)}
      </div>

      <h3 style="color: #9333ea;">EQUITY</h3>
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${equityRows}</tbody>
        <tfoot><tr class="total"><td colspan="2">Total Equity</td><td class="equity">${formatCurrency(data.balanceSheet.totals.totalEquity)}</td></tr></tfoot>
      </table>

      <div style="font-weight: bold; font-size: 16px; margin: 10px 0; color: #9333ea;">
        TOTAL LIABILITIES & EQUITY: ${formatCurrency(data.balanceSheet.totals.totalLiabilitiesAndEquity)}
      </div>

      <div class="summary">
        <div style="text-align: center; color: ${data.accountingEquation.isBalanced ? '#059669' : '#dc2626'}; font-weight: bold;">
          ${data.accountingEquation.isBalanced ? '✓ Balance Sheet is Balanced (Assets = Liabilities + Equity)' : '✗ Balance Sheet is NOT Balanced'}
        </div>
      </div>
    `
  }

  const generateProfitLossPDF = (doc: jsPDF, data: any, startY: number) => {
    // Revenue Section
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('REVENUE', 20, startY)
    
    const revenueData = data.revenue.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Code', 'Account', 'Amount']],
      body: revenueData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      margin: { left: 20, right: 20 }
    })

    let currentY = (doc as any).lastAutoTable.finalY + 10

    // Total Revenue
    doc.setFontSize(12)
    doc.text(`Total Revenue: ${formatCurrency(data.summary.totalRevenue)}`, 20, currentY)
    currentY += 15

    // Expenses Section
    doc.setFontSize(14)
    doc.text('EXPENSES', 20, currentY)
    
    const expenseData = data.expenses.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Code', 'Account', 'Amount']],
      body: expenseData,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 20, right: 20 }
    })

    currentY = (doc as any).lastAutoTable.finalY + 10

    // Summary
    doc.setFontSize(12)
    doc.text(`Total Expenses: ${formatCurrency(data.summary.totalExpenses)}`, 20, currentY)
    currentY += 10

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`NET PROFIT: ${formatCurrency(data.summary.netProfit)}`, 20, currentY)
    currentY += 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Profit Margin: ${data.summary.profitMargin}%`, 20, currentY)
  }

  const generateTrialBalancePDF = (doc: jsPDF, data: any, startY: number) => {
    const tableData = data.trialBalance.map((acc: any) => [
      acc.code,
      acc.name,
      acc.type,
      formatCurrency(acc.debit),
      formatCurrency(acc.credit)
    ])

    autoTable(doc, {
      startY,
      head: [['Code', 'Account', 'Type', 'Debit', 'Credit']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 }
    })

    let currentY = (doc as any).lastAutoTable.finalY + 10

    // Summary
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Debits: ${formatCurrency(data.summary.totalDebits)}`, 20, currentY)
    doc.text(`Total Credits: ${formatCurrency(data.summary.totalCredits)}`, 100, currentY)
    currentY += 10
    
    const balancedText = data.summary.isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗'
    doc.setTextColor(data.summary.isBalanced ? 0 : 255, data.summary.isBalanced ? 150 : 0, 0)
    doc.text(`Difference: ${formatCurrency(data.summary.difference)} - ${balancedText}`, 20, currentY)
    doc.setTextColor(0, 0, 0)
  }

  const generateBalanceSheetPDF = (doc: jsPDF, data: any, startY: number) => {
    // Assets Section
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(59, 130, 246)
    doc.text('ASSETS', 20, startY)
    doc.setTextColor(0, 0, 0)

    // Current Assets
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Current Assets', 25, startY + 10)
    
    const currentAssetsData = data.balanceSheet.assets.current.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])

    autoTable(doc, {
      startY: startY + 15,
      head: [['Code', 'Account', 'Amount']],
      body: currentAssetsData,
      theme: 'plain',
      margin: { left: 30, right: 20 }
    })

    let currentY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Current Assets: ${formatCurrency(data.balanceSheet.assets.totals.currentAssets)}`, 30, currentY)
    currentY += 10

    // Fixed Assets
    doc.setFont('helvetica', 'bold')
    doc.text('Fixed Assets', 25, currentY)
    
    const fixedAssetsData = data.balanceSheet.assets.fixed.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Code', 'Account', 'Amount']],
      body: fixedAssetsData,
      theme: 'plain',
      margin: { left: 30, right: 20 }
    })

    currentY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Fixed Assets: ${formatCurrency(data.balanceSheet.assets.totals.fixedAssets)}`, 30, currentY)
    currentY += 10

    doc.setFontSize(12)
    doc.text(`TOTAL ASSETS: ${formatCurrency(data.balanceSheet.assets.totals.totalAssets)}`, 25, currentY)
    currentY += 15

    // Liabilities Section
    doc.setTextColor(249, 115, 22)
    doc.setFontSize(14)
    doc.text('LIABILITIES', 20, currentY)
    doc.setTextColor(0, 0, 0)

    // Current Liabilities
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Current Liabilities', 25, currentY + 10)
    
    const currentLiabilitiesData = data.balanceSheet.liabilities.current.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])

    autoTable(doc, {
      startY: currentY + 15,
      head: [['Code', 'Account', 'Amount']],
      body: currentLiabilitiesData,
      theme: 'plain',
      margin: { left: 30, right: 20 }
    })

    currentY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Current Liabilities: ${formatCurrency(data.balanceSheet.liabilities.totals.currentLiabilities)}`, 30, currentY)
    currentY += 10

    // Long-term Liabilities
    doc.setFont('helvetica', 'bold')
    doc.text('Long-term Liabilities', 25, currentY)
    
    const longTermLiabilitiesData = data.balanceSheet.liabilities.longTerm.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Code', 'Account', 'Amount']],
      body: longTermLiabilitiesData,
      theme: 'plain',
      margin: { left: 30, right: 20 }
    })

    currentY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Long-term Liabilities: ${formatCurrency(data.balanceSheet.liabilities.totals.longTermLiabilities)}`, 30, currentY)
    currentY += 10

    doc.setFontSize(12)
    doc.text(`TOTAL LIABILITIES: ${formatCurrency(data.balanceSheet.liabilities.totals.totalLiabilities)}`, 25, currentY)
    currentY += 15

    // Equity Section
    doc.setTextColor(147, 51, 234)
    doc.setFontSize(14)
    doc.text('EQUITY', 20, currentY)
    doc.setTextColor(0, 0, 0)

    const equityData = data.balanceSheet.equity.map((acc: any) => [
      acc.code,
      acc.name,
      formatCurrency(acc.balance)
    ])

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Code', 'Account', 'Amount']],
      body: equityData,
      theme: 'plain',
      margin: { left: 30, right: 20 }
    })

    currentY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Equity: ${formatCurrency(data.balanceSheet.totals.totalEquity)}`, 30, currentY)
    currentY += 10

    doc.setFontSize(12)
    doc.text(`TOTAL LIABILITIES & EQUITY: ${formatCurrency(data.balanceSheet.totals.totalLiabilitiesAndEquity)}`, 25, currentY)
    currentY += 15

    // Balance Check
    doc.setFontSize(11)
    const isBalanced = data.accountingEquation.isBalanced
    doc.setTextColor(isBalanced ? 0 : 255, isBalanced ? 150 : 0, 0)
    doc.text(`Balance Check: ${formatCurrency(data.accountingEquation.balance)} - ${isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗'}`, 25, currentY)
    doc.setTextColor(0, 0, 0)
  }

  const handleClose = () => {
    setSelectedReport(null)
    setStartDate('')
    setEndDate('')
    setReportData(null)
    setHasGenerated(false)
    onClose()
  }

  const selectedConfig = selectedReport ? REPORT_CONFIG[selectedReport] : null

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            Generate Accounting Reports
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Report Type Selection */}
            <div className="space-y-3">
              <Label>Select Report Type</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12">
                    {selectedConfig ? (
                      <div className="flex items-center gap-2">
                        <selectedConfig.icon className={`w-5 h-5 ${selectedConfig.color}`} />
                        <span>{selectedConfig.title}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">Choose a report type...</span>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {Object.entries(REPORT_CONFIG).map(([key, config]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setSelectedReport(key as ReportType)}
                      className="flex items-center gap-2"
                    >
                      <config.icon className={`w-5 h-5 ${config.color}`} />
                      <div>
                        <p className="font-medium">{config.title}</p>
                        <p className="text-xs text-slate-500">{config.description}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Preview Section */}
            {hasGenerated && reportData && selectedConfig && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    {selectedConfig.title}
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </h4>
                  <div className="flex gap-2">
                    <Button onClick={handlePreview} variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button onClick={handleDownloadPDF} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Preview based on report type */}
                {reportData.profitLoss && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Revenue</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(reportData.profitLoss.summary.totalRevenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Expenses</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(reportData.profitLoss.summary.totalExpenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Net Profit</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(reportData.profitLoss.summary.netProfit)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {reportData.trialBalance && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Total Debits</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(reportData.trialBalance.summary.totalDebits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Credits</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(reportData.trialBalance.summary.totalCredits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <p className={`text-lg font-bold ${reportData.trialBalance.summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          {reportData.trialBalance.summary.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      {reportData.trialBalance.trialBalance.length} accounts in trial balance
                    </p>
                  </div>
                )}

                {reportData.balanceSheet && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Total Assets</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(reportData.balanceSheet.balanceSheet.assets.totals.totalAssets)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Liabilities</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(reportData.balanceSheet.balanceSheet.liabilities.totals.totalLiabilities)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Equity</p>
                        <p className="text-lg font-bold text-purple-600">
                          {formatCurrency(reportData.balanceSheet.balanceSheet.totals.totalEquity)}
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs text-center ${reportData.balanceSheet.accountingEquation.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      {reportData.balanceSheet.accountingEquation.isBalanced 
                        ? '✓ Balance Sheet is Balanced (Assets = Liabilities + Equity)' 
                        : '✗ Balance Sheet is NOT Balanced'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="px-8"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={!selectedReport || loading}
            className="px-8 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Preview Modal */}
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-slate-600" />
            {selectedConfig?.title} - Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {isPreviewLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : reportData && selectedConfig ? (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold text-slate-800">{selectedConfig.title}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {reportData.profitLoss 
                    ? `Period: ${reportData.profitLoss.period.startDate} to ${reportData.profitLoss.period.endDate}`
                    : reportData.trialBalance
                    ? `Period: ${reportData.trialBalance.period.startDate} to ${reportData.trialBalance.period.endDate}`
                    : reportData.balanceSheet
                    ? `As of: ${reportData.balanceSheet.period.asOfDate}`
                    : ''}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Generated on: {new Date().toLocaleString()}
                </p>
              </div>

              {/* Profit & Loss Report Preview */}
              {reportData.profitLoss && (
                <div className="space-y-6">
                  {/* Revenue Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-green-600 mb-3">REVENUE</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                            <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.profitLoss.revenue.map((acc, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="p-3 text-slate-600">{acc.code}</td>
                              <td className="p-3 text-slate-800">{acc.name}</td>
                              <td className="p-3 text-right text-green-600 font-medium">
                                {formatCurrency(acc.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-green-50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-slate-700">Total Revenue</td>
                            <td className="p-3 text-right font-bold text-green-600">
                              {formatCurrency(reportData.profitLoss.summary.totalRevenue)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-red-600 mb-3">EXPENSES</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                            <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.profitLoss.expenses.map((acc, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="p-3 text-slate-600">{acc.code}</td>
                              <td className="p-3 text-slate-800">{acc.name}</td>
                              <td className="p-3 text-right text-red-600 font-medium">
                                {formatCurrency(acc.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-red-50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-slate-700">Total Expenses</td>
                            <td className="p-3 text-right font-bold text-red-600">
                              {formatCurrency(reportData.profitLoss.summary.totalExpenses)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="bg-slate-100 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Net Profit</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {formatCurrency(reportData.profitLoss.summary.netProfit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Profit Margin</p>
                        <p className="text-xl font-bold text-slate-700">
                          {reportData.profitLoss.summary.profitMargin}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trial Balance Report Preview */}
              {reportData.trialBalance && (
                <div className="space-y-6">
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                          <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                          <th className="text-left p-3 border-b font-medium text-slate-600">Type</th>
                          <th className="text-right p-3 border-b font-medium text-slate-600">Debit</th>
                          <th className="text-right p-3 border-b font-medium text-slate-600">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.trialBalance.trialBalance.map((acc, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-3 text-slate-600">{acc.code}</td>
                            <td className="p-3 text-slate-800">{acc.name}</td>
                            <td className="p-3 text-slate-500">{acc.type}</td>
                            <td className="p-3 text-right text-slate-700">{formatCurrency(acc.debit)}</td>
                            <td className="p-3 text-right text-slate-700">{formatCurrency(acc.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50">
                        <tr>
                          <td colSpan={3} className="p-3 font-bold text-slate-700">TOTALS</td>
                          <td className="p-3 text-right font-bold text-blue-600">
                            {formatCurrency(reportData.trialBalance.summary.totalDebits)}
                          </td>
                          <td className="p-3 text-right font-bold text-blue-600">
                            {formatCurrency(reportData.trialBalance.summary.totalCredits)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="bg-slate-100 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Difference</p>
                        <p className={`text-xl font-bold ${reportData.trialBalance.summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(reportData.trialBalance.summary.difference)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Status</p>
                        <p className={`text-xl font-bold ${reportData.trialBalance.summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          {reportData.trialBalance.summary.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Accounts</p>
                        <p className="text-xl font-bold text-slate-700">
                          {reportData.trialBalance.trialBalance.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Sheet Report Preview */}
              {reportData.balanceSheet && (
                <div className="space-y-6">
                  {/* Assets Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 mb-3">ASSETS</h3>
                    
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Current Assets</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                              <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.balanceSheet.balanceSheet.assets.current.map((acc, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="p-3 text-slate-600">{acc.code}</td>
                                <td className="p-3 text-slate-800">{acc.name}</td>
                                <td className="p-3 text-right text-blue-600 font-medium">
                                  {formatCurrency(acc.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-50">
                            <tr>
                              <td colSpan={2} className="p-3 font-bold text-slate-700">Total Current Assets</td>
                              <td className="p-3 text-right font-bold text-blue-600">
                                {formatCurrency(reportData.balanceSheet.balanceSheet.assets.totals.currentAssets)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Fixed Assets</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                              <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.balanceSheet.balanceSheet.assets.fixed.map((acc, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="p-3 text-slate-600">{acc.code}</td>
                                <td className="p-3 text-slate-800">{acc.name}</td>
                                <td className="p-3 text-right text-blue-600 font-medium">
                                  {formatCurrency(acc.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-50">
                            <tr>
                              <td colSpan={2} className="p-3 font-bold text-slate-700">Total Fixed Assets</td>
                              <td className="p-3 text-right font-bold text-blue-600">
                                {formatCurrency(reportData.balanceSheet.balanceSheet.assets.totals.fixedAssets)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="bg-blue-100 rounded-lg p-4 text-center">
                      <p className="text-sm text-blue-600 mb-1">TOTAL ASSETS</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(reportData.balanceSheet.balanceSheet.assets.totals.totalAssets)}
                      </p>
                    </div>
                  </div>

                  {/* Liabilities Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-600 mb-3">LIABILITIES</h3>
                    
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Current Liabilities</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-orange-50">
                            <tr>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                              <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.balanceSheet.balanceSheet.liabilities.current.map((acc, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="p-3 text-slate-600">{acc.code}</td>
                                <td className="p-3 text-slate-800">{acc.name}</td>
                                <td className="p-3 text-right text-orange-600 font-medium">
                                  {formatCurrency(acc.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-orange-50">
                            <tr>
                              <td colSpan={2} className="p-3 font-bold text-slate-700">Total Current Liabilities</td>
                              <td className="p-3 text-right font-bold text-orange-600">
                                {formatCurrency(reportData.balanceSheet.balanceSheet.liabilities.totals.currentLiabilities)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Long-term Liabilities</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-orange-50">
                            <tr>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                              <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                              <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.balanceSheet.balanceSheet.liabilities.longTerm.map((acc, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="p-3 text-slate-600">{acc.code}</td>
                                <td className="p-3 text-slate-800">{acc.name}</td>
                                <td className="p-3 text-right text-orange-600 font-medium">
                                  {formatCurrency(acc.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-orange-50">
                            <tr>
                              <td colSpan={2} className="p-3 font-bold text-slate-700">Total Long-term Liabilities</td>
                              <td className="p-3 text-right font-bold text-orange-600">
                                {formatCurrency(reportData.balanceSheet.balanceSheet.liabilities.totals.longTermLiabilities)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="bg-orange-100 rounded-lg p-4 text-center">
                      <p className="text-sm text-orange-600 mb-1">TOTAL LIABILITIES</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {formatCurrency(reportData.balanceSheet.balanceSheet.liabilities.totals.totalLiabilities)}
                      </p>
                    </div>
                  </div>

                  {/* Equity Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-purple-600 mb-3">EQUITY</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-purple-50">
                          <tr>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Code</th>
                            <th className="text-left p-3 border-b font-medium text-slate-600">Account</th>
                            <th className="text-right p-3 border-b font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.balanceSheet.balanceSheet.equity.map((acc, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="p-3 text-slate-600">{acc.code}</td>
                              <td className="p-3 text-slate-800">{acc.name}</td>
                              <td className="p-3 text-right text-purple-600 font-medium">
                                {formatCurrency(acc.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-purple-50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-slate-700">Total Equity</td>
                            <td className="p-3 text-right font-bold text-purple-600">
                              {formatCurrency(reportData.balanceSheet.balanceSheet.totals.totalEquity)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="space-y-4">
                    <div className="bg-purple-100 rounded-lg p-4 text-center">
                      <p className="text-sm text-purple-600 mb-1">TOTAL LIABILITIES & EQUITY</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {formatCurrency(reportData.balanceSheet.balanceSheet.totals.totalLiabilitiesAndEquity)}
                      </p>
                    </div>

                    <div className={`rounded-lg p-4 text-center ${
                      reportData.balanceSheet.accountingEquation.isBalanced 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      <p className={`text-lg font-bold ${
                        reportData.balanceSheet.accountingEquation.isBalanced 
                          ? 'text-green-700' 
                          : 'text-red-700'
                      }`}>
                        {reportData.balanceSheet.accountingEquation.isBalanced 
                          ? '✓ Balance Sheet is Balanced (Assets = Liabilities + Equity)' 
                          : '✗ Balance Sheet is NOT Balanced'}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Assets: {formatCurrency(reportData.balanceSheet.accountingEquation.assets)} | 
                        Liabilities + Equity: {formatCurrency(reportData.balanceSheet.accountingEquation.liabilitiesAndEquity)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No report data available. Please generate a report first.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 flex-shrink-0">
          <Button variant="outline" className="px-6" onClick={() => setShowPreview(false)}>
            Close
          </Button>
          <Button variant="outline" className="px-6" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button className="px-8 bg-blue-600 hover:bg-blue-700" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

