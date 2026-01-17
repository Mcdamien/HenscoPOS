import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const journalEntries = await db.journalEntry.findMany({
      include: {
        lines: {
          include: {
            account: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Calculate stats
    let totalIncome = 0
    let totalExpenditure = 0
    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0

    const entries = journalEntries.flatMap(je => {
      return je.lines.map(line => {
        // Find "other account" for simple double-entry
        // If there are exactly 2 lines, the other line is the "other account"
        let otherAccount = ''
        if (je.lines.length === 2) {
          const otherLine = je.lines.find(l => l.id !== line.id)
          if (otherLine) {
            otherAccount = otherLine.account.code
          }
        }

        return {
          id: line.id,
          date: je.date.toISOString(),
          description: line.description || je.description,
          amount: Math.max(line.debit, line.credit),
          type: line.account.type.toLowerCase().replace('expense', 'expenditure'),
          account: line.account.code,
          otherAccount: otherAccount,
          debit: line.debit,
          credit: line.credit,
        }
      })
    })

    // Calculate stats from account balances
    const accounts = await db.account.findMany()
    
    for (const account of accounts) {
      const type = account.type
      if (type === 'REVENUE') {
        totalIncome += account.balance
      } else if (type === 'EXPENSE') {
        totalExpenditure += account.balance
      } else if (type === 'ASSET') {
        totalAssets += account.balance
      } else if (type === 'LIABILITY') {
        totalLiabilities += account.balance
      } else if (type === 'EQUITY') {
        totalEquity += account.balance
      }
    }

    const netProfit = totalIncome - totalExpenditure
    const cashFlow = totalIncome - totalExpenditure // Simplified placeholder

    return NextResponse.json({
      stats: {
        totalIncome,
        totalExpenditure,
        totalAssets,
        totalLiabilities,
        totalEquity,
        netProfit,
        cashFlow
      },
      entries
    })
  } catch (error) {
    console.error('Failed to fetch accounting data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounting data' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { date, description, account: accountCode, otherAccount: otherAccountName, debit, credit, type } = data

    // Find the primary account
    const account = await db.account.findUnique({
      where: { code: accountCode }
    })

    if (!account) {
      return NextResponse.json({ error: `Account ${accountCode} not found` }, { status: 404 })
    }

    // Find or create the other account
    let otherAccount = null
    if (otherAccountName) {
      otherAccount = await db.account.findFirst({
        where: { 
          OR: [
            { name: { equals: otherAccountName, mode: 'insensitive' } },
            { code: otherAccountName }
          ]
        }
      })

      if (!otherAccount) {
        // Create new account if it doesn't exist
        // Determine type for the other account
        let otherAccountType = 'ASSET' // Default to Asset (Cash)
        if (type === 'income') otherAccountType = 'ASSET'
        else if (type === 'expenditure') otherAccountType = 'ASSET'
        else if (type === 'asset') otherAccountType = 'ASSET'
        else if (type === 'liability') otherAccountType = 'ASSET'
        else if (type === 'equity') otherAccountType = 'ASSET'

        // Generate a random code for new account (prefix based on type)
        const prefixMap: any = { 'ASSET': '1', 'LIABILITY': '2', 'EQUITY': '3', 'REVENUE': '4', 'EXPENSE': '5' }
        const prefix = prefixMap[otherAccountType] || '9'
        const randomSuffix = Math.floor(Math.random() * 9000) + 1000
        const newCode = `${prefix}${randomSuffix}`

        otherAccount = await db.account.create({
          data: {
            code: newCode,
            name: otherAccountName,
            type: otherAccountType as any,
            balance: 0
          }
        })
      }
    }

    // Generate entry number
    const lastEntry = await db.journalEntry.findFirst({
      orderBy: { entryNumber: 'desc' }
    })
    const lastNum = lastEntry ? parseInt(lastEntry.entryNumber.replace('JE', '')) : 0
    const entryNumber = `JE${(lastNum + 1).toString().padStart(6, '0')}`

    const journalEntry = await db.$transaction(async (tx) => {
      const lines = [
        {
          accountId: account.id,
          description,
          debit,
          credit
        }
      ]

      if (otherAccount) {
        lines.push({
          accountId: otherAccount.id,
          description,
          debit: credit, // Opposite of primary account
          credit: debit
        })
      }

      const je = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(date),
          description,
          isPosted: true,
          lines: {
            create: lines
          }
        },
        include: {
          lines: {
            include: {
              account: true
            }
          }
        }
      })

      // Update balances
      const updateBalance = async (accId: string, dbt: number, crdt: number) => {
        const acc = await tx.account.findUnique({ where: { id: accId } })
        if (!acc) return

        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE'
        const balanceChange = isDebitNormal ? (dbt - crdt) : (crdt - dbt)
        
        await tx.account.update({
          where: { id: accId },
          data: { balance: { increment: balanceChange } }
        })
      }

      await updateBalance(account.id, debit, credit)
      if (otherAccount) {
        await updateBalance(otherAccount.id, credit, debit)
      }

      return je
    })

    return NextResponse.json(journalEntry)
  } catch (error) {
    console.error('Failed to create journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to create journal entry' },
      { status: 500 }
    )
  }
}
