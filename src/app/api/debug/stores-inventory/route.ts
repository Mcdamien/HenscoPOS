import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const stores = await db.store.findMany({
      include: {
        transactions: {
          select: { id: true, total: true, createdAt: true }
        }
      }
    })

    const inventories = await db.inventory.groupBy({
      by: ['storeId'],
      _count: { id: true },
      _sum: { stock: true }
    })

    const transactions = await db.transaction.count()

    return NextResponse.json({
      stores: stores.map(s => ({
        id: s.id,
        name: s.name,
        transactionCount: s.transactions.length,
        totalSales: s.transactions.reduce((sum, t) => sum + (t.total || 0), 0)
      })),
      inventoryCounts: inventories,
      totalTransactions: transactions
    })
  } catch (error) {
    console.error('Debug failed:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    )
  }
}
