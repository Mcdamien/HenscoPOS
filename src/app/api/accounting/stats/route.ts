import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AccountType } from '@prisma/client'

export async function GET() {
  try {
    const accounts = await db.account.findMany()

    const stats = {
      totalIncome: 0,
      totalExpenditure: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netProfit: 0,
      cashFlow: 0
    }

    accounts.forEach(acc => {
      switch (acc.type) {
        case AccountType.REVENUE:
          stats.totalIncome += acc.balance
          break
        case AccountType.EXPENSE:
          stats.totalExpenditure += acc.balance
          break
        case AccountType.ASSET:
          stats.totalAssets += acc.balance
          if (acc.code === '1010') { // Cash account
            stats.cashFlow = acc.balance // Simplified cash flow
          }
          break
        case AccountType.LIABILITY:
          stats.totalLiabilities += acc.balance
          break
        case AccountType.EQUITY:
          stats.totalEquity += acc.balance
          break
      }
    })

    stats.netProfit = stats.totalIncome - stats.totalExpenditure

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch accounting stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounting stats' },
      { status: 500 }
    )
  }
}
