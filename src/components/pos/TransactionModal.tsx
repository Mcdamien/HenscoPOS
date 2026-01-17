'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, TrendingUp, TrendingDown, Banknote, CreditCard, Briefcase, CheckSquare, Square, X } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn, handleNumberKeyDown } from '@/lib/utils'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (transaction: Omit<TransactionData, 'id'>) => void
  type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity'
}

interface TransactionData {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity'
  account: string
  otherAccount: string
  debit: number
  credit: number
}

interface CustomAccount {
  code: string
  name: string
  type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity'
  createdAt: string
}

// Child accounts structure based on seed data
const CHILD_ACCOUNTS = {
  income: [
    { code: '4010', name: 'Sales Revenue' },
    { code: '4020', name: 'Service Revenue' },
    { code: '4030', name: 'Interest Income' },
    { code: '4040', name: 'Rental Income' },
  ],
  expenditure: [
    { code: '5010', name: 'Rent' },
    { code: '5020', name: 'Utilities' },
    { code: '5030', name: 'Salaries & Wages' },
    { code: '5040', name: 'Marketing' },
    { code: '5050', name: 'Insurance' },
    { code: '5060', name: 'Office Supplies' },
    { code: '5100', name: 'Cost of Goods Sold' },
  ],
  asset: [
    { code: '1010', name: 'Cash' },
    { code: '1020', name: 'Accounts Receivable' },
    { code: '1030', name: 'Inventory' },
    { code: '1040', name: 'Prepaid Expenses' },
    { code: '1100', name: 'Equipment' },
    { code: '1110', name: 'Vehicle' },
    { code: '1120', name: 'Building' },
  ],
  liability: [
    { code: '2010', name: 'Accounts Payable' },
    { code: '2020', name: 'Credit Card Balances' },
    { code: '2030', name: 'Short-Term Loans' },
    { code: '2100', name: 'Bank Loans' },
    { code: '2110', name: 'Mortgages' },
  ],
  equity: [
    { code: '3010', name: 'Owner\'s Capital' },
    { code: '3020', name: 'Retained Earnings' },
    { code: '3030', name: 'Owner\'s Draws/Dividends' },
  ],
}

// Accounts that default to Credit (money going out)
const CREDIT_DEFAULT_TYPES = ['income', 'liability', 'equity']

// Accounts that default to Debit (money coming in)
const DEBIT_DEFAULT_TYPES = ['expenditure', 'asset']

// Load custom accounts from localStorage
const loadCustomAccounts = (): CustomAccount[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('customAccounts')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save custom accounts to localStorage
const saveCustomAccounts = (accounts: CustomAccount[]) => {
  localStorage.setItem('customAccounts', JSON.stringify(accounts))
}

// Helper function to validate numeric input for currency fields
const handleNumberChange = (value: string): string => {
  // Allow empty string
  if (value === '') return ''
  
  // Remove any non-numeric characters except decimal point
  const sanitized = value.replace(/[^0-9.]/g, '')
  
  // Ensure only one decimal point
  const parts = sanitized.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }
  
  // Limit to 2 decimal places
  if (parts[1] && parts[1].length > 2) {
    return parts[0] + '.' + parts[1].slice(0, 2)
  }
  
  return sanitized
}

// Debounce hook for preventing excessive re-renders
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Generate next available account code for custom accounts
const generateAccountCode = (type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity', customAccounts: CustomAccount[]): string => {
  const existingCodes = new Set([
    ...CHILD_ACCOUNTS[type].map(a => a.code),
    ...customAccounts.filter(a => a.type === type).map(a => a.code)
  ])
  
  // Define ranges for each type
  const ranges: Record<string, number[]> = {
    income: [4090, 4100, 4110, 4120, 4130, 4140, 4150, 4160, 4170, 4180, 4190, 4200, 4210, 4220, 4230, 4240, 4250, 4260, 4270, 4280, 4290, 4300, 4310, 4320, 4330, 4340, 4350, 4360, 4370, 4380, 4390, 4400, 4410, 4420, 4430, 4440, 4450, 4460, 4470, 4480, 4490, 4500, 4510, 4520, 4530, 4540, 4550, 4560, 4570, 4580, 4590, 4600, 4610, 4620, 4630, 4640, 4650, 4660, 4670, 4680, 4690, 4700, 4710, 4720, 4730, 4740, 4750, 4760, 4770, 4780, 4790, 4800, 4810, 4820, 4830, 4840, 4850, 4860, 4870, 4880, 4890, 4900, 4910, 4920, 4930, 4940, 4950, 4960, 4970, 4980, 4990],
    expenditure: [5090, 5100, 5110, 5120, 5130, 5140, 5150, 5160, 5170, 5180, 5190, 5200, 5210, 5220, 5230, 5240, 5250, 5260, 5270, 5280, 5290, 5300, 5310, 5320, 5330, 5340, 5350, 5360, 5370, 5380, 5390, 5400, 5410, 5420, 5430, 5440, 5450, 5460, 5470, 5480, 5490, 5500, 5510, 5520, 5530, 5540, 5550, 5560, 5570, 5580, 5590, 5600, 5610, 5620, 5630, 5640, 5650, 5660, 5670, 5680, 5690, 5700, 5710, 5720, 5730, 5740, 5750, 5760, 5770, 5780, 5790, 5800, 5810, 5820, 5830, 5840, 5850, 5860, 5870, 5880, 5890, 5900, 5910, 5920, 5930, 5940, 5950, 5960, 5970, 5980, 5990],
    asset: [1090, 1100, 1110, 1120, 1130, 1140, 1150, 1160, 1170, 1180, 1190, 1200, 1210, 1220, 1230, 1240, 1250, 1260, 1270, 1280, 1290, 1300, 1310, 1320, 1330, 1340, 1350, 1360, 1370, 1380, 1390, 1400, 1410, 1420, 1430, 1440, 1450, 1460, 1470, 1480, 1490, 1500, 1510, 1520, 1530, 1540, 1550, 1560, 1570, 1580, 1590, 1600, 1610, 1620, 1630, 1640, 1650, 1660, 1670, 1680, 1690, 1700, 1710, 1720, 1730, 1740, 1750, 1760, 1770, 1780, 1790, 1800, 1810, 1820, 1830, 1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990],
    liability: [2090, 2100, 2110, 2120, 2130, 2140, 2150, 2160, 2170, 2180, 2190, 2200, 2210, 2220, 2230, 2240, 2250, 2260, 2270, 2280, 2290, 2300, 2310, 2320, 2330, 2340, 2350, 2360, 2370, 2380, 2390, 2400, 2410, 2420, 2430, 2440, 2450, 2460, 2470, 2480, 2490, 2500, 2510, 2520, 2530, 2540, 2550, 2560, 2570, 2580, 2590, 2600, 2610, 2620, 2630, 2640, 2650, 2660, 2670, 2680, 2690, 2700, 2710, 2720, 2730, 2740, 2750, 2760, 2770, 2780, 2790, 2800, 2810, 2820, 2830, 2840, 2850, 2860, 2870, 2880, 2890, 2900, 2910, 2920, 2930, 2940, 2950, 2960, 2970, 2980, 2990],
    equity: [3090, 3100, 3110, 3120, 3130, 3140, 3150, 3160, 3170, 3180, 3190, 3200, 3210, 3220, 3230, 3240, 3250, 3260, 3270, 3280, 3290, 3300, 3310, 3320, 3330, 3340, 3350, 3360, 3370, 3380, 3390, 3400, 3410, 3420, 3430, 3440, 3450, 3460, 3470, 3480, 3490, 3500, 3510, 3520, 3530, 3540, 3550, 3560, 3570, 3580, 3590, 3600, 3610, 3620, 3630, 3640, 3650, 3660, 3670, 3680, 3690, 3700, 3710, 3720, 3730, 3740, 3750, 3760, 3770, 3780, 3790, 3800, 3810, 3820, 3830, 3840, 3850, 3860, 3870, 3880, 3890, 3900, 3910, 3920, 3930, 3940, 3950, 3960, 3970, 3980, 3990],
  }
  
  const typeRanges = ranges[type]
  
  // Find next available code in range
  for (const code of typeRanges) {
    const codeStr = code.toString()
    if (!existingCodes.has(codeStr)) {
      return codeStr
    }
  }
  
  // If range is full, append sequential number
  const lastCode = Math.max(...Array.from(existingCodes).map(Number))
  return (lastCode + 10).toString()
}

export default function TransactionModal({ isOpen, onClose, onSuccess, type }: TransactionModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    account: '',
    otherAccount: '',
    debit: '',
    credit: ''
  })
  const [overrideGrayOut, setOverrideGrayOut] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customAccounts, setCustomAccounts] = useState<CustomAccount[]>(() => loadCustomAccounts())
  const [otherAccountTouched, setOtherAccountTouched] = useState(false)

  // Debounce debit and credit values to prevent excessive total recalculations and re-renders
  const debouncedDebit = useDebounce(formData.debit, 300)
  const debouncedCredit = useDebounce(formData.credit, 300)

  const childAccounts = CHILD_ACCOUNTS[type] || []
  const isCreditDefault = CREDIT_DEFAULT_TYPES.includes(type)
  const isDebitDefault = DEBIT_DEFAULT_TYPES.includes(type)

  // Check if debit field should be disabled
  const isDebitDisabled = !overrideGrayOut && isCreditDefault
  // Check if credit field should be disabled
  const isCreditDisabled = !overrideGrayOut && isDebitDefault

  // Memoize total calculation to prevent unnecessary recalculations on every keystroke
  const total = useMemo(() => {
    const debit = parseFloat(debouncedDebit) || 0
    const credit = parseFloat(debouncedCredit) || 0
    return debit - credit
  }, [debouncedDebit, debouncedCredit])

  const getTypeConfig = () => {
    switch (type) {
      case 'income':
        return {
          title: 'Add Income Transaction',
          icon: TrendingUp,
          iconColor: 'text-green-600',
          placeholder: 'Enter income description...',
          defaultAccount: '4010'
        }
      case 'expenditure':
        return {
          title: 'Add Expenditure Transaction',
          icon: TrendingDown,
          iconColor: 'text-red-600',
          placeholder: 'Enter expense description...',
          defaultAccount: '5010'
        }
      case 'asset':
        return {
          title: 'Add Asset Transaction',
          icon: Banknote,
          iconColor: 'text-blue-600',
          placeholder: 'Enter asset description...',
          defaultAccount: '1010'
        }
      case 'liability':
        return {
          title: 'Add Liability Transaction',
          icon: CreditCard,
          iconColor: 'text-orange-600',
          placeholder: 'Enter liability description...',
          defaultAccount: '2010'
        }
      case 'equity':
        return {
          title: 'Add Equity Transaction',
          icon: Briefcase,
          iconColor: 'text-purple-600',
          placeholder: 'Enter equity description...',
          defaultAccount: '3010'
        }
    }
  }

  const config = getTypeConfig()!
  const Icon = config.icon

  // Get merged accounts (standard + custom) for this transaction type
  const mergedAccounts = useMemo(() => {
    const standardAccounts = CHILD_ACCOUNTS[type] || []
    const customAccountsForType = customAccounts.filter(a => a.type === type)
    return [...standardAccounts, ...customAccountsForType.map(a => ({ code: a.code, name: a.name }))]
  }, [type, customAccounts])

  const customAccountCodes = useMemo(() => 
    new Set(customAccounts.filter(a => a.type === type).map(a => a.code)),
    [customAccounts, type]
  )

  // Handle adding custom account on submit
  const addCustomAccountIfNeeded = useCallback(() => {
    const trimmedOtherAccount = formData.otherAccount.trim()
    if (!trimmedOtherAccount) return

    // Check if this account already exists (as standard or custom)
    const existingStandard = CHILD_ACCOUNTS[type]?.some(a => a.name.toLowerCase() === trimmedOtherAccount.toLowerCase())
    const existingCustom = customAccounts.some(a => a.name.toLowerCase() === trimmedOtherAccount.toLowerCase() && a.type === type)

    if (existingStandard || existingCustom) {
      // Account already exists, no need to add
      return
    }

    // Generate new code and add to custom accounts
    const newCode = generateAccountCode(type, customAccounts)
    const newCustomAccount: CustomAccount = {
      code: newCode,
      name: trimmedOtherAccount,
      type,
      createdAt: new Date().toISOString()
    }

    const updatedCustomAccounts = [...customAccounts, newCustomAccount]
    setCustomAccounts(updatedCustomAccounts)
    saveCustomAccounts(updatedCustomAccounts)
    toast.success(`New account "${trimmedOtherAccount}" added to ${type} accounts`)
  }, [formData.otherAccount, type, customAccounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.date.trim()) {
      toast.error('Date is required')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }

    if (!formData.account && !formData.otherAccount.trim()) {
      toast.error('Please select an account or enter an other account')
      return
    }

    if (parseFloat(formData.debit) === 0 && parseFloat(formData.credit) === 0) {
      toast.error('Please enter either debit or credit amount')
      return
    }

    setSubmitting(true)

    // Add custom account if needed before submitting
    addCustomAccountIfNeeded()

    try {
      const response = await fetch('/api/accounting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: formData.date,
          description: formData.description,
          account: formData.account,
          otherAccount: formData.otherAccount.trim(),
          debit: parseFloat(formData.debit) || 0,
          credit: parseFloat(formData.credit) || 0,
          type: type
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add transaction')
      }
      
      const journalEntry = await response.json()
      
      const transaction = {
        date: formData.date,
        description: formData.description,
        amount: Math.abs(total),
        type: type,
        account: formData.account,
        otherAccount: formData.otherAccount.trim(),
        debit: parseFloat(formData.debit) || 0,
        credit: parseFloat(formData.credit) || 0
      }

      toast.success(`${config.title.split(' ')[2]} added successfully!`)
      onSuccess(transaction)
      handleClose()
    } catch (error: any) {
      console.error('Failed to add transaction:', error)
      toast.error(error.message || 'Failed to add transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      account: '',
      otherAccount: '',
      debit: '',
      credit: ''
    })
    setOverrideGrayOut(false)
    onClose()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            {config.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Date Field - Keep as is */}
            <div>
              <Label htmlFor="date">Date of Entry</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            {/* Type of Account Dropdown - NOW SHOWS CUSTOM ACCOUNTS TOO */}
            <div>
              <Label htmlFor="account">Type of Account</Label>
              <Select
                value={formData.account}
                onValueChange={(value) => setFormData({ ...formData, account: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type..." />
                </SelectTrigger>
                <SelectContent>
                  {mergedAccounts.map((account) => {
                    const isCustom = customAccountCodes.has(account.code)
                    return (
                      <SelectItem key={account.code} value={account.code}>
                        {account.code} - {account.name}{isCustom && ' (Custom)'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {customAccountCodes.size > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  ✓ {customAccountCodes.size} custom account(s) available
                </p>
              )}
            </div>

            {/* Other Account - WITH AUTO-SAVE TO DROP DOWN */}
            <div>
              <Label htmlFor="otherAccount">Other Account (Optional)</Label>
              <div className="relative">
                <Input
                  id="otherAccount"
                  type="text"
                  placeholder="Enter unique account name if not listed..."
                  value={formData.otherAccount}
                  onChange={(e) => {
                    setFormData({ ...formData, otherAccount: e.target.value })
                    setOtherAccountTouched(true)
                  }}
                  onBlur={() => setOtherAccountTouched(false)}
                  className="pr-10"
                />
                {formData.otherAccount && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, otherAccount: '' })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Use this for accounts not listed above. New accounts are automatically saved and appear in dropdown for next transaction.
              </p>
            </div>

            {/* Description - NEW positioned after account */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                placeholder={config.placeholder}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            {/* Debit and Credit Fields with Gray-out Logic */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="debit" className={cn(isDebitDisabled && "text-slate-400")}>
                    Debit (GHS)
                  </Label>
                  <Input
                    id="debit"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]{0,2}"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.debit}
                    onChange={(e) => setFormData({ ...formData, debit: handleNumberChange(e.target.value) })}
                    onKeyDown={handleNumberKeyDown}
                    disabled={isDebitDisabled}
                    className={cn(isDebitDisabled && "bg-slate-50 text-slate-400")}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {isDebitDefault ? "Money coming in" : "Default disabled for this account type"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="credit" className={cn(isCreditDisabled && "text-slate-400")}>
                    Credit (GHS)
                  </Label>
                  <Input
                    id="credit"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]{0,2}"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.credit}
                    onChange={(e) => setFormData({ ...formData, credit: handleNumberChange(e.target.value) })}
                    onKeyDown={handleNumberKeyDown}
                    disabled={isCreditDisabled}
                    className={cn(isCreditDisabled && "bg-slate-50 text-slate-400")}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {isCreditDefault ? "Money going out" : "Default disabled for this account type"}
                  </p>
                </div>
              </div>

              {/* Override Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideGrayOut(!overrideGrayOut)}
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
                >
                  {overrideGrayOut ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="font-medium">Override & Enable Both Fields</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 pl-6">
                Check this to allow entry in both debit and credit fields when needed
              </p>
            </div>

            {/* Total Display */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Total:</span>
                <span className={`text-lg font-bold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(total))}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {total >= 0 ? 'Net Debit' : 'Net Credit'}
              </p>
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="transaction-form" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
