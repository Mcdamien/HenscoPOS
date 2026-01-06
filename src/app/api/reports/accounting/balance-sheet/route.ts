import { NextResponse } from 'next/server'

// Mock accounting data based on the seed data structure
const getAccountingData = () => {
  // Current Assets (1xxx)
  const currentAssets = [
    { code: '1010', name: 'Cash', balance: 45000 },
    { code: '1020', name: 'Accounts Receivable', balance: 28000 },
    { code: '1030', name: 'Inventory', balance: 67000 },
    { code: '1040', name: 'Prepaid Expenses', balance: 8500 },
  ]

  // Fixed Assets
  const fixedAssets = [
    { code: '1100', name: 'Equipment', balance: 85000 },
    { code: '1110', name: 'Vehicle', balance: 45000 },
    { code: '1120', name: 'Building', balance: 250000 },
    { code: '1190', name: 'Accumulated Depreciation', balance: -25000 },
  ]

  // Current Liabilities
  const currentLiabilities = [
    { code: '2010', name: 'Accounts Payable', balance: 32000 },
    { code: '2020', name: 'Credit Card Balances', balance: 8500 },
    { code: '2030', name: 'Short-Term Loans', balance: 25000 },
  ]

  // Long-term Liabilities
  const longTermLiabilities = [
    { code: '2100', name: 'Bank Loans', balance: 120000 },
    { code: '2110', name: 'Mortgages', balance: 180000 },
  ]

  // Equity
  const equityAccounts = [
    { code: '3010', name: 'Owner\'s Capital', balance: 150000 },
    { code: '3020', name: 'Retained Earnings', balance: 85000 },
    { code: '3030', name: 'Owner\'s Draws/Dividends', balance: -25000 },
  ]

  return {
    currentAssets,
    fixedAssets,
    currentLiabilities,
    longTermLiabilities,
    equityAccounts
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const {
      currentAssets,
      fixedAssets,
      currentLiabilities,
      longTermLiabilities,
      equityAccounts
    } = getAccountingData()

    // Calculate totals
    const totalCurrentAssets = currentAssets.reduce((sum, acc) => sum + acc.balance, 0)
    const totalFixedAssets = fixedAssets.reduce((sum, acc) => sum + acc.balance, 0)
    const totalAssets = totalCurrentAssets + totalFixedAssets

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, acc) => sum + acc.balance, 0)
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, acc) => sum + acc.balance, 0)
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

    const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.balance, 0)

    // Calculate accounting equation
    const liabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceCheck = totalAssets - liabilitiesAndEquity

    return NextResponse.json({
      success: true,
      data: {
        period: {
          asOfDate: endDate || new Date().toISOString().split('T')[0]
        },
        balanceSheet: {
          assets: {
            current: currentAssets,
            fixed: fixedAssets,
            totals: {
              currentAssets: totalCurrentAssets,
              fixedAssets: totalFixedAssets,
              totalAssets
            }
          },
          liabilities: {
            current: currentLiabilities,
            longTerm: longTermLiabilities,
            totals: {
              currentLiabilities: totalCurrentLiabilities,
              longTermLiabilities: totalLongTermLiabilities,
              totalLiabilities
            }
          },
          equity: equityAccounts,
          totals: {
            totalEquity,
            totalLiabilitiesAndEquity: liabilitiesAndEquity
          }
        },
        accountingEquation: {
          assets: totalAssets,
          liabilities: totalLiabilities,
          equity: totalEquity,
          liabilitiesAndEquity,
          balance: balanceCheck,
          isBalanced: Math.abs(balanceCheck) < 0.01
        }
      }
    })
  } catch (error) {
    console.error('Error generating balance sheet:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate balance sheet' },
      { status: 500 }
    )
  }
}

