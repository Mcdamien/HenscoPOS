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
  const [generatingTemplate, setGeneratingTemplate] = useState(false)
  const [results, setResults] = useState<{ created: number; updated: number; errors: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (!selectedFile.name.endsWith('.xlsx')) {
        toast.error('Only .xlsx files are supported')
        return
      }
      setFile(selectedFile)
      setResults(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      if (file.size === 0) {
        toast.error('The selected file is empty.')
        setImporting(false)
        return
      }

      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      console.log('Uploaded file:', file)

      try {
        await workbook.xlsx.load(buffer)
        console.log('Workbook loaded successfully:', workbook)
      } catch (error: any) {
        console.error('Error loading workbook:', error)
        if (error.message && error.message.includes('central directory')) {
          toast.error('Invalid Excel file format. Please ensure it is a valid .xlsx file and not an older .xls file.')
        } else {
          toast.error('Failed to load the Excel file. Please ensure it is a valid .xlsx file.')
        }
        setImporting(false)
        return
      }

      if (workbook.worksheets.length === 0) {
        toast.error('The uploaded file does not contain any worksheets.')
        setImporting(false)
        return
      }

      const worksheet = workbook.worksheets[0]
      console.log('Loaded worksheet name:', worksheet.name)
      const jsonData: any[] = []
      
      // IMPROVED HEADER PARSING: Include empty cells to maintain column indices
      const headerRow = worksheet.getRow(1)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const headerValue = cell.text ? String(cell.text).trim() : String(cell.value || '').trim()
        headers[colNumber - 1] = headerValue
      })
      console.log('Detected headers:', headers)
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const rowData: Record<string, any> = {}
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) {
              // Handle cell values (could be formulas or objects)
              let value = cell.value
              if (value && typeof value === 'object') {
                if ('result' in value) {
                  value = value.result
                } else if ('richText' in value && Array.isArray(value.richText)) {
                  value = value.richText.map((rt: any) => rt.text).join('')
                } else if ('text' in value) {
                  value = value.text
                }
              }
              rowData[header] = value
            }
          })
          
          // Only add rows that have at least one value
          if (Object.values(rowData).some(v => v !== null && v !== undefined && v !== '')) {
            jsonData.push(rowData)
          }
        }
      })

      console.log('Parsed JSON data (count):', jsonData.length)

      const products = jsonData.map((row: any) => {
        // Find keys case-insensitively
        const findValue = (keys: string[]) => {
          const foundKey = Object.keys(row).find(k => 
            keys.some(searchKey => k.toLowerCase() === searchKey.toLowerCase())
          )
          return foundKey ? row[foundKey] : undefined
        }

        const rawName = findValue(['Name', 'Product', 'Item'])
        const name = rawName ? String(rawName).trim() : ''
        
        const rawCost = findValue(['Cost', 'Cost Price'])
        const rawPrice = findValue(['Price', 'Selling Price'])
        const rawStock = findValue(['Stock', 'Quantity', 'Qty'])

        return {
          name,
          cost: !isNaN(parseFloat(String(rawCost))) ? parseFloat(String(rawCost)) : 0,
          price: !isNaN(parseFloat(String(rawPrice))) ? parseFloat(String(rawPrice)) : 0,
          stock: !isNaN(parseInt(String(rawStock))) ? parseInt(String(rawStock)) : 0
        }
      }).filter(p => p.name && p.name.length > 0)

      console.log('Processed products for API (count):', products.length)

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
        const status = response.status
        const statusText = response.statusText
        const rawText = await response.text().catch(() => '')
        let errorData = {}
        try {
          errorData = JSON.parse(rawText)
        } catch (e) {
          errorData = { rawText }
        }
        
        const errorMessage = (errorData as any).error || `Server Error (${status}: ${statusText})`
        toast.error(errorMessage)
        console.error('Import failed:', {
          status,
          statusText,
          errorMessage,
          errorData
        })
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('An error occurred during import')
    } finally {
      setImporting(false)
    }
  }

  const handleGenerateSampleFile = async () => {
    setGeneratingTemplate(true)
    const toastId = toast.loading('Preparing template...')
    console.log('Starting template generation...')
    
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Sample Inventory')

      // Define headers
      worksheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Cost', key: 'cost', width: 15 },
        { header: 'Price', key: 'price', width: 15 },
        { header: 'Stock', key: 'stock', width: 12 }
      ]

      // Try to fetch existing products with a timeout
      console.log('Fetching products for template...')
      toast.loading('Fetching existing products...', { id: toastId })
      
      let itemsToRows = []
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch('/api/products', { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const products = await response.json()
          console.log(`Fetched ${products.length} products.`)
          // Limit to 50 items for the sample template
          itemsToRows = products.slice(0, 50).map((p: any) => ({
            name: p.name,
            cost: p.cost,
            price: p.price,
            stock: 0
          }))
        }
      } catch (fetchError) {
        console.warn('Fetch timed out or failed, proceeding with blank template:', fetchError)
      }

      if (itemsToRows.length > 0) {
        worksheet.addRows(itemsToRows)
      } else {
        worksheet.addRow({
          name: 'Sample Product',
          cost: 10.00,
          price: 15.00,
          stock: 50
        })
      }

      console.log('Writing workbook to buffer...')
      toast.loading('Generating file...', { id: toastId })
      const buffer = await workbook.xlsx.writeBuffer()
      console.log('Workbook buffer created, size:', buffer.byteLength)
      
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Inventory_Template_${new Date().toISOString().split('T')[0]}.xlsx`
      
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }, 100)
      
      toast.success('Template generated successfully', { id: toastId })
    } catch (error) {
      console.error('Error generating sample file:', error)
      toast.error('Failed to generate sample file. Please try again.', { id: toastId })
    } finally {
      setGeneratingTemplate(false)
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
                  Upload an Excel file (.xlsx) with the following columns:
                </p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono grid grid-cols-4 gap-2 text-center">
                  <div className="font-bold border-b pb-1">Name / Product</div>
                  <div className="font-bold border-b pb-1">Cost / Cost Price</div>
                  <div className="font-bold border-b pb-1">Price / Selling Price</div>
                  <div className="font-bold border-b pb-1">Stock / Qty</div>
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
                  accept=".xlsx"
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
                      <p className="text-xs text-slate-400">Excel files only (.xlsx)</p>
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

              <Button 
                onClick={handleGenerateSampleFile} 
                className="mt-4 w-full" 
                variant="outline"
                disabled={generatingTemplate}
              >
                {generatingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Template...
                  </>
                ) : (
                  'Generate Sample File'
                )}
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
                <div className="text-center p-3 bg-slate-50 rounded-xl border">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Created</p>
                  <p className="text-2xl font-black text-emerald-600">{results.created}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Updated</p>
                  <p className="text-2xl font-black text-blue-600">{results.updated}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border">
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
