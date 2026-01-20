import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AccountType, AccountSubType } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const endDateStr = searchParams.get('endDate')
    const asOfDate = endDateStr ? new Date(endDateStr) : new Date()

    // Get all asset, liability, and equity accounts
    const accounts = await db.account.findMany({
      where: {
        type: {
          in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY]
        }
      },
      include: {
        journalEntries: {
          where: {
            journalEntry: {
              date: {
                lte: asOfDate
              }
            }
          }
        }
      }
    })

    // Also need to include Net Income (Revenue - Expenses) up to asOfDate in Equity (Retained Earnings)
    const pnlAccounts = await db.account.findMany({
      where: {
        type: {
          in: [AccountType.REVENUE, AccountType.EXPENSE]
        }
      },
      include: {
        journalEntries: {
          where: {
            journalEntry: {
              date: {
                lte: asOfDate
              }
            }
          }
        }
      }
    })

    const totalRevenue = pnlAccounts
      .filter(acc => acc.type === AccountType.REVENUE)
      .reduce((sum, acc) => {
        return sum + acc.journalEntries.reduce((s, line) => s + (line.credit - line.debit), 0)
      }, 0)

    const totalExpenses = pnlAccounts
      .filter(acc => acc.type === AccountType.EXPENSE)
      .reduce((sum, acc) => {
        return sum + acc.journalEntries.reduce((s, line) => s + (line.debit - line.credit), 0)
      }, 0)

    const netIncome = totalRevenue - totalExpenses

    const formatAccount = (acc: any) => {
      let balance = 0
      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        balance = acc.journalEntries.reduce((sum: number, line: any) => sum + (line.debit - line.credit), 0)
      } else {
        balance = acc.journalEntries.reduce((sum: number, line: any) => sum + (line.credit - line.debit), 0)
      }
      return {
        code: acc.code,
        name: acc.name,
        balance
      }
    }

    const currentAssets = accounts
      .filter(acc => acc.type === AccountType.ASSET && acc.subType === AccountSubType.CURRENT_ASSET)
      .map(formatAccount)
      .filter(acc => acc.balance !== 0)

    const fixedAssets = accounts
      .filter(acc => acc.type === AccountType.ASSET && acc.subType === AccountSubType.FIXED_ASSET)
      .map(formatAccount)
      .filter(acc => acc.balance !== 0)

    const currentLiabilities = accounts
      .filter(acc => acc.type === AccountType.LIABILITY && acc.subType === AccountSubType.CURRENT_LIABILITY)
      .map(formatAccount)
      .filter(acc => acc.balance !== 0)

    const longTermLiabilities = accounts
      .filter(acc => acc.type === AccountType.LIABILITY && acc.subType === AccountSubType.LONG_TERM_LIABILITY)
      .map(formatAccount)
      .filter(acc => acc.balance !== 0)

    const equityAccounts = accounts
      .filter(acc => acc.type === AccountType.EQUITY)
      .map(formatAccount)
      .filter(acc => acc.balance !== 0)

    // Add Net Income to Retained Earnings or as a separate line
    equityAccounts.push({
      code: 'NET-INC',
      name: 'Net Income (Current Period)',
      balance: netIncome
    })

    // Calculate totals
    const totalCurrentAssets = currentAssets.reduce((sum, acc) => sum + acc.balance, 0)
    const totalFixedAssets = fixedAssets.reduce((sum, acc) => sum + acc.balance, 0)
    const totalAssets = totalCurrentAssets + totalFixedAssets

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, acc) => sum + acc.balance, 0)
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, acc) => sum + acc.balance, 0)
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

    const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.balance, 0)

    const liabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceCheck = totalAssets - liabilitiesAndEquity

    return NextResponse.json({
      success: true,
      data: {
        period: {
          asOfDate: asOfDate.toISOString().split('T')[0]
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
