'use client'

import { useState, useRef } from 'react'
import { X, FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'

interface ImportProductsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ImportProductsModal({ isOpen, onClose, onSuccess }: ImportProductsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ created: number; updated: number; errors: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResults(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      console.log('Uploaded file:', file)

      try {
        await workbook.xlsx.load(buffer)
        console.log('Workbook loaded successfully:', workbook)
      } catch (error) {
        console.error('Error loading workbook:', error)
        toast.error('Failed to load the Excel file. Please ensure it is a valid .xlsx file.')
        setImporting(false)
        return
      }

      if (workbook.worksheets.length === 0) {
        toast.error('The uploaded file does not contain any worksheets.')
        setImporting(false)
        return
      }

      const worksheet = workbook.worksheets[0]
      console.log('Loaded worksheet:', worksheet)
      const jsonData: any[] = []
      
      // Read rows starting from row 2 (assuming row 1 is header)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const rowData: Record<string, any> = {}
          row.eachCell((cell, colNumber) => {
            const headerCell = worksheet.getRow(1).getCell(colNumber)
            rowData[headerCell.value as string] = cell.value
          })
          jsonData.push(rowData)
        }
      })

      // Map excel columns to expected API fields
      // Assuming headers like "Name", "Cost", "Price", "Stock"
      const products = jsonData.map((row: any) => ({
        name: row.Name || row.name || row.Product || row.product,
        cost: row.Cost || row.cost || 0,
        price: row.Price || row.price || 0,
        stock: row.Stock || row.stock || row.Quantity || row.qty || 0
      })).filter(p => p.name)

      if (products.length === 0) {
        toast.error('No valid products found in the file')
        setImporting(false)
        return
      }

      const response = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      })

      if (response.ok) {
        const data = await response.json()
        setResults({
          created: data.created,
          updated: data.updated,
          errors: data.errors
        })
        toast.success('Import completed successfully!')
        onSuccess()
      } else {
        toast.error('Failed to import products')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('An error occurred during import')
    } finally {
      setImporting(false)
    }
  }

  const handleGenerateSampleFile = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Sample Inventory')

    // Define headers
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Cost', key: 'cost', width: 15 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Stock', key: 'stock', width: 10 }
    ]

    try {
      const response = await fetch('/api/inventory?store=Main%20Store')
      if (!response.ok) {
        throw new Error('Failed to fetch inventory items')
      }

      const inventoryItems = await response.json()
      inventoryItems.forEach((item: any) => {
        worksheet.addRow({
          name: item.name,
          cost: item.cost,
          price: item.price,
          stock: item.stock
        })
      })

      // Generate file and trigger download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Sample_Inventory.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating sample file:', error)
      toast.error('Failed to generate sample file')
    }
  }

  const handleClose = () => {
    setFile(null)
    setResults(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Products from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!results ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">
                  Upload an Excel file (.xlsx or .xls) with the following columns:
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono grid grid-cols-4 gap-2 text-center">
                  <div className="font-bold border-b pb-1">Name</div>
                  <div className="font-bold border-b pb-1">Cost</div>
                  <div className="font-bold border-b pb-1">Price</div>
                  <div className="font-bold border-b pb-1">Stock</div>
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`w-8 h-8 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                      <p className="text-xs text-emerald-600">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-600">Click to browse or drag and drop</p>
                      <p className="text-xs text-slate-400">Excel files only (.xlsx, .xls)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose} disabled={importing}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!file || importing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Start Import'
                  )}
                </Button>
              </div>

              <Button onClick={handleGenerateSampleFile} className="mt-4">
                Generate Sample File
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-800">Import Complete</AlertTitle>
                <AlertDescription className="text-emerald-700">
                  Your file has been processed successfully.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Created</p>
                  <p className="text-2xl font-black text-emerald-600">{results.created}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Updated</p>
                  <p className="text-2xl font-black text-blue-600">{results.updated}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Errors</p>
                  <p className="text-2xl font-black text-red-600">{results.errors}</p>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
