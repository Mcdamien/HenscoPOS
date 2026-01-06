import { NextResponse } from 'next/server'

// Mock accounting data based on the seed data structure
const getAccountingData = () => {
  // All accounts for trial balance
  const accounts = [
    // Assets (1xxx)
    { code: '1010', name: 'Cash', type: 'ASSET', balance: 45000 },
    { code: '1020', name: 'Accounts Receivable', type: 'ASSET', balance: 28000 },
    { code: '1030', name: 'Inventory', type: 'ASSET', balance: 67000 },
    { code: '1040', name: 'Prepaid Expenses', type: 'ASSET', balance: 8500 },
    { code: '1100', name: 'Equipment', type: 'ASSET', balance: 85000 },
    { code: '1110', name: 'Vehicle', type: 'ASSET', balance: 45000 },
    { code: '1120', name: 'Building', type: 'ASSET', balance: 250000 },
    
    // Liabilities (2xxx)
    { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', balance: 32000 },
    { code: '2020', name: 'Credit Card Balances', type: 'LIABILITY', balance: 8500 },
    { code: '2030', name: 'Short-Term Loans', type: 'LIABILITY', balance: 25000 },
    { code: '2100', name: 'Bank Loans', type: 'LIABILITY', balance: 120000 },
    { code: '2110', name: 'Mortgages', type: 'LIABILITY', balance: 180000 },
    
    // Equity (3xxx)
    { code: '3010', name: 'Owner\'s Capital', type: 'EQUITY', balance: 150000 },
    { code: '3020', name: 'Retained Earnings', type: 'EQUITY', balance: 85000 },
    { code: '3030', name: 'Owner\'s Draws/Dividends', type: 'EQUITY', balance: -25000 },
    
    // Revenue (4xxx)
    { code: '4010', name: 'Sales Revenue', type: 'REVENUE', balance: 125000 },
    { code: '4020', name: 'Service Revenue', type: 'REVENUE', balance: 28000 },
    { code: '4030', name: 'Interest Income', type: 'REVENUE', balance: 2500 },
    { code: '4040', name: 'Rental Income', type: 'REVENUE', balance: 12000 },
    
    // Expenses (5xxx)
    { code: '5010', name: 'Rent', type: 'EXPENSE', balance: 18000 },
    { code: '5020', name: 'Utilities', type: 'EXPENSE', balance: 4500 },
    { code: '5030', name: 'Salaries & Wages', type: 'EXPENSE', balance: 52000 },
    { code: '5040', name: 'Marketing', type: 'EXPENSE', balance: 8500 },
    { code: '5050', name: 'Insurance', type: 'EXPENSE', balance: 3600 },
    { code: '5060', name: 'Office Supplies', type: 'EXPENSE', balance: 2800 },
    { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', balance: 42000 },
  ]

  return accounts
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const accounts = getAccountingData()

    // Calculate totals
    let totalDebits = 0
    let totalCredits = 0

    const trialBalance = accounts.map(acc => {
      // For trial balance, determine if balance is debit or credit
      // Assets and Expenses have normal debit balances
      // Liabilities, Equity, and Revenue have normal credit balances
      
      let debitBalance = 0
      let creditBalance = 0
      
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        debitBalance = Math.abs(acc.balance)
        totalDebits += debitBalance
      } else {
        creditBalance = Math.abs(acc.balance)
        totalCredits += creditBalance
      }

      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: debitBalance,
        credit: creditBalance,
        balance: acc.balance
      }
    })

    // Sort by account code
    trialBalance.sort((a, b) => a.code.localeCompare(b.code))

    // Calculate difference (should be zero for balanced books)
    const difference = totalDebits - totalCredits

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate || 'All Time',
          endDate: endDate || 'Present'
        },
        trialBalance,
        summary: {
          totalDebits,
          totalCredits,
          difference,
          isBalanced: Math.abs(difference) < 0.01
        }
      }
    })
  } catch (error) {
    console.error('Error generating trial balance:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate trial balance' },
      { status: 500 }
    )
  }
}

