import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        store: {
          name: { in: [...ALLOWED_SHOPS] }
        }
      },
      include: {
        store: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedTransactions = transactions.map(tx => ({
      id: tx.transactionId,
      date: tx.createdAt.toISOString(),
      store: tx.store.name,
      subtotal: tx.subtotal,
      tax: tx.tax,
      total: tx.total,
      items: tx.items.map(item => ({
        id: item.id,
        productId: item.productId,
        itemName: item.itemName,
        itemPrice: item.itemPrice,
        itemCost: item.itemCost,
        qty: item.qty
      }))
    }))

    return NextResponse.json(formattedTransactions)
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
