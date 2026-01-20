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
      id: tx.id,
      transactionId: tx.transactionId,
      date: tx.createdAt.toISOString(),
      storeId: tx.storeId,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, transactionId, storeId, subtotal, tax, total, createdAt, items } = body

    if (!transactionId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing transaction data' },
        { status: 400 }
      )
    }

    // Check if transaction already exists
    const existingTransaction = await db.transaction.findUnique({
      where: { transactionId }
    })

    if (existingTransaction) {
      return NextResponse.json(existingTransaction)
    }

    // Create the transaction
    const transaction = await db.transaction.create({
      data: {
        transactionId,
        storeId,
        subtotal,
        tax,
        total,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || item.id,
            itemName: item.itemName || item.name,
            itemPrice: item.itemPrice || item.price,
            itemCost: item.itemCost || 0,
            qty: item.qty
          }))
        }
      },
      include: {
        items: true
      }
    })

    // Note: We don't automatically update inventory here during sync 
    // to avoid double-counting if inventory was already updated elsewhere
    // or if the sync is a replay. In a robust system, we'd have better
    // idempotent inventory updates.

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Failed to create/sync transaction:', error)
    return NextResponse.json(
      { error: 'Failed to sync transaction' },
      { status: 500 }
    )
  }
}
