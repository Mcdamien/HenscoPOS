import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AccountType } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, description, account: accountCode, otherAccount, debit, credit, type } = body

    if (!date || !description || (!debit && !credit)) {
      return NextResponse.json(
        { error: 'Missing required transaction data' },
        { status: 400 }
      )
    }

    // 1. Find or create the primary account
    let primaryAccount = await db.account.findUnique({
      where: { code: accountCode }
    })

    if (!primaryAccount && otherAccount) {
      // Create custom account if it doesn't exist
      // Map frontend types to Prisma AccountType
      const typeMap: Record<string, AccountType> = {
        'income': AccountType.REVENUE,
        'expenditure': AccountType.EXPENSE,
        'asset': AccountType.ASSET,
        'liability': AccountType.LIABILITY,
        'equity': AccountType.EQUITY
      }

      const prismaType = typeMap[type] || AccountType.ASSET

      // Find MainAccount for this type
      const mainAccount = await db.mainAccount.findFirst({
        where: { type: prismaType }
      })

      if (!mainAccount) {
        throw new Error(`Main account for type ${prismaType} not found. Please run seed.`)
      }

      primaryAccount = await db.account.create({
        data: {
          code: accountCode,
          name: otherAccount,
          type: prismaType,
          mainAccountId: mainAccount.id,
          balance: 0
        }
      })
    }

    if (!primaryAccount) {
      return NextResponse.json(
        { error: `Account with code ${accountCode} not found` },
        { status: 404 }
      )
    }

    // 2. Determine balancing account (Cash by default)
    const cashAccount = await db.account.findUnique({
      where: { code: '1010' } // Cash account code from seed
    })

    if (!cashAccount) {
      throw new Error('Cash account (1010) not found. Please run seed.')
    }

    // 3. Generate entry number (JE-XXXXX)
    const lastEntry = await db.journalEntry.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    
    let nextNum = 1
    if (lastEntry && lastEntry.entryNumber.startsWith('JE-')) {
      const currentNum = parseInt(lastEntry.entryNumber.split('-')[1])
      if (!isNaN(currentNum)) {
        nextNum = currentNum + 1
      }
    }
    const entryNumber = `JE-${nextNum.toString().padStart(5, '0')}`

    // 4. Create Journal Entry and Lines
    const amount = debit || credit
    const isDebit = !!debit

    const journalEntry = await db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(date),
          description,
          lines: {
            create: [
              {
                accountId: primaryAccount.id,
                description,
                debit: debit || 0,
                credit: credit || 0
              },
              {
                accountId: cashAccount.id,
                description,
                // If primary is Debit, balancing is Credit, and vice versa
                debit: isDebit ? 0 : amount,
                credit: isDebit ? amount : 0
              }
            ]
          }
        },
        include: {
          lines: true
        }
      })

      // 5. Update balances
      // Update primary account balance
      // ASSET/EXPENSE: Debit increases, Credit decreases
      // LIABILITY/EQUITY/REVENUE: Credit increases, Debit decreases
      const updateAccountBalance = async (accId: string, d: number, c: number, accType: AccountType) => {
        const diff = (accType === AccountType.ASSET || accType === AccountType.EXPENSE) 
          ? d - c 
          : c - d
        
        await tx.account.update({
          where: { id: accId },
          data: {
            balance: {
              increment: diff
            }
          }
        })
      }

      await updateAccountBalance(primaryAccount.id, debit || 0, credit || 0, primaryAccount.type)
      await updateAccountBalance(cashAccount.id, isDebit ? 0 : amount, isDebit ? amount : 0, cashAccount.type)

      return entry
    })

    return NextResponse.json(journalEntry)
  } catch (error: any) {
    console.error('Failed to create journal entry:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync accounting transaction' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const entries = await db.journalEntry.findMany({
      include: {
        lines: {
          include: {
            account: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50
    })

    const formattedEntries = entries.map(entry => {
      // Find the primary line (the one that isn't Cash, unless both are Cash)
      // Or just return all lines formatted as expected by the frontend
      
      // The frontend expects:
      // { id, date, description, amount, type, account, otherAccount, debit, credit }
      
      const primaryLine = entry.lines.find(l => l.account.code !== '1010') || entry.lines[0]
      
      return {
        id: entry.id,
        date: entry.date.toISOString().split('T')[0],
        description: entry.description,
        amount: Math.max(primaryLine.debit, primaryLine.credit),
        type: primaryLine.account.type.toLowerCase(),
        account: primaryLine.account.code,
        otherAccount: primaryLine.account.name,
        debit: primaryLine.debit,
        credit: primaryLine.credit
      }
    })

    return NextResponse.json(formattedEntries)
  } catch (error) {
    console.error('Failed to fetch journal entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entries' },
      { status: 500 }
    )
  }
}
