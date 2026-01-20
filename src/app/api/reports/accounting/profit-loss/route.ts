import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AccountType } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    const startDate = startDateStr ? new Date(startDateStr) : null
    const endDate = endDateStr ? new Date(endDateStr) : null

    // Get all revenue and expense accounts
    const accounts = await db.account.findMany({
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
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate })
              }
            }
          }
        }
      }
    })

    const revenueAccounts = accounts
      .filter(acc => acc.type === AccountType.REVENUE)
      .map(acc => {
        // For REVENUE: Credit increases balance, Debit decreases it
        const balance = acc.journalEntries.reduce((sum, line) => sum + (line.credit - line.debit), 0)
        return {
          code: acc.code,
          name: acc.name,
          balance
        }
      })
      .filter(acc => acc.balance !== 0)

    const expenseAccounts = accounts
      .filter(acc => acc.type === AccountType.EXPENSE)
      .map(acc => {
        // For EXPENSE: Debit increases balance, Credit decreases it
        const balance = acc.journalEntries.reduce((sum, line) => sum + (line.debit - line.credit), 0)
        return {
          code: acc.code,
          name: acc.name,
          balance
        }
      })
      .filter(acc => acc.balance !== 0)

    // Calculate totals
    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    const netProfit = totalRevenue - totalExpenses

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDateStr || 'All Time',
          endDate: endDateStr || 'Present'
        },
        revenue: revenueAccounts,
        expenses: expenseAccounts,
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
