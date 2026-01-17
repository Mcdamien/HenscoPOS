import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET() {
  try {
    const stores = await db.store.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { transactions: true, inventories: true }
        }
      }
    })

    const transactions = await db.transaction.findMany({
      select: {
        id: true,
        total: true,
        store: { select: { name: true } }
      },
      take: 5
    })

    const transactionsByStore = await db.transaction.groupBy({
      by: ['storeId'],
      _count: { id: true },
      _sum: { total: true }
    })

    const storeLookup = stores.reduce((acc, s) => {
      acc[s.id] = s.name
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({
      allowedShops: ALLOWED_SHOPS,
      databaseStores: stores.map(s => ({
        id: s.id,
        name: s.name,
        transactions: s._count.transactions,
        inventories: s._count.inventories
      })),
      transactionsByStore: transactionsByStore.map(ts => ({
        storeName: storeLookup[ts.storeId],
        storeId: ts.storeId,
        transactionCount: ts._count.id,
        totalAmount: ts._sum.total
      })),
      recentTransactions: transactions.map(t => ({
        id: t.id,
        store: t.store.name,
        total: t.total
      })),
      summary: {
        totalTransactions: await db.transaction.count(),
        totalStores: stores.length,
        storesMatchingFilter: stores.filter(s => ALLOWED_SHOPS.includes(s.name as any)).length
      }
    })
  } catch (error) {
    console.error('Check stores failed:', error)
    return NextResponse.json(
      { error: 'Check stores failed', details: String(error) },
      { status: 500 }
    )
  }
}
