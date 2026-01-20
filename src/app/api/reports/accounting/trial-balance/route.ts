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

    // Get all accounts with their journal entry lines for the period
    const accounts = await db.account.findMany({
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

    // Calculate totals
    let totalDebits = 0
    let totalCredits = 0

    const trialBalance = accounts.map(acc => {
      // Calculate total debits and credits for this account in the period
      const debitTotal = acc.journalEntries.reduce((sum, line) => sum + line.debit, 0)
      const creditTotal = acc.journalEntries.reduce((sum, line) => sum + line.credit, 0)
      
      let balance = 0
      let debitBalance = 0
      let creditBalance = 0
      
      // Determine if account has normal debit or credit balance
      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        balance = debitTotal - creditTotal
        if (balance >= 0) {
          debitBalance = balance
        } else {
          creditBalance = Math.abs(balance)
        }
      } else {
        balance = creditTotal - debitTotal
        if (balance >= 0) {
          creditBalance = balance
        } else {
          debitBalance = Math.abs(balance)
        }
      }

      totalDebits += debitBalance
      totalCredits += creditBalance

      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: debitBalance,
        credit: creditBalance,
        balance: balance
      }
    }).filter(acc => acc.debit !== 0 || acc.credit !== 0)

    // Sort by account code
    trialBalance.sort((a, b) => a.code.localeCompare(b.code))

    const difference = totalDebits - totalCredits

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDateStr || 'All Time',
          endDate: endDateStr || 'Present'
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
