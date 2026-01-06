import { NextResponse } from 'next/server'

// Mock accounting data based on the seed data structure
const getAccountingData = () => {
  // Revenue accounts (type: REVENUE)
  const revenueAccounts = [
    { code: '4010', name: 'Sales Revenue', balance: 125000 },
    { code: '4020', name: 'Service Revenue', balance: 28000 },
    { code: '4030', name: 'Interest Income', balance: 2500 },
    { code: '4040', name: 'Rental Income', balance: 12000 },
  ]

  // Expense accounts (type: EXPENSE)
  const expenseAccounts = [
    { code: '5010', name: 'Rent', balance: 18000 },
    { code: '5020', name: 'Utilities', balance: 4500 },
    { code: '5030', name: 'Salaries & Wages', balance: 52000 },
    { code: '5040', name: 'Marketing', balance: 8500 },
    { code: '5050', name: 'Insurance', balance: 3600 },
    { code: '5060', name: 'Office Supplies', balance: 2800 },
    { code: '5100', name: 'Cost of Goods Sold', balance: 42000 },
  ]

  return { revenueAccounts, expenseAccounts }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const { revenueAccounts, expenseAccounts } = getAccountingData()

    // Calculate totals
    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    const netProfit = totalRevenue - totalExpenses

    // Filter by date range if provided
    let filteredRevenue = revenueAccounts
    let filteredExpenses = expenseAccounts

    if (startDate && endDate) {
      // In a real implementation, you would filter by transaction dates
      // For now, we return all data
      filteredRevenue = revenueAccounts
      filteredExpenses = expenseAccounts
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate || 'All Time',
          endDate: endDate || 'Present'
        },
        revenue: filteredRevenue,
        expenses: filteredExpenses,
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0
        }
      }
    })
  } catch (error) {
    console.error('Error generating P&L report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate P&L report' },
      { status: 500 }
    )
  }
}

