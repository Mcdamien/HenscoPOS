import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface CartItem {
  id: string
  itemId: number
  name: string
  price: number
  qty: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store, items }: { store: string; items: CartItem[] } = body

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    // Get or create store
    let storeRecord = await db.store.findUnique({
      where: { name: store }
    })

    if (!storeRecord) {
      storeRecord = await db.store.create({
        data: { name: store }
      })
    }

    // Verify stock and calculate totals
    let subtotal = 0
    const itemsToCreate: {
      productId: string
      itemName: string
      itemPrice: number
      itemCost: number
      qty: number
    }[] = []

    const inventoryUpdates: {
      inventoryId: string
      qty: number
    }[] = []

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.id },
        include: {
          inventories: {
            where: { storeId: storeRecord.id }
          }
        }
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.name} not found` },
          { status: 404 }
        )
      }

      const storeStock = product.inventories[0]?.stock || 0

      if (storeStock < item.qty) {
        return NextResponse.json(
          { error: `Insufficient stock for ${item.name}. Only ${storeStock} available.` },
          { status: 400 }
        )
      }

      subtotal += product.price * item.qty
      
      itemsToCreate.push({
        productId: item.id,
        itemName: item.name,
        itemPrice: product.price,
        itemCost: product.cost,
        qty: item.qty,
      })

      if (product.inventories[0]?.id) {
        inventoryUpdates.push({
          inventoryId: product.inventories[0].id,
          qty: item.qty
        })
      }
    }

    // Calculate tax and total
    const tax = subtotal * 0.125
    const total = subtotal + tax

    // Get the next transaction ID
    const lastTransaction = await db.transaction.findFirst({
      orderBy: { transactionId: 'desc' }
    })
    const nextTransactionId = lastTransaction ? lastTransaction.transactionId + 1 : Math.floor(Math.random() * 10000)

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        transactionId: nextTransactionId,
        storeId: storeRecord.id,
        subtotal,
        tax,
        total,
        items: {
          create: itemsToCreate
        }
      },
      include: {
        items: true
      }
    })

    // Update inventory for each item
    for (const update of inventoryUpdates) {
      await db.inventory.update({
        where: { id: update.inventoryId },
        data: {
          stock: {
            decrement: update.qty
          }
        }
      })
    }

    // Return transaction data for receipt
    return NextResponse.json({
      id: transaction.transactionId,
      date: transaction.createdAt.toISOString(),
      store: store,
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      total: transaction.total,
      items: transaction.items.map(item => ({
        id: item.id,
        itemName: item.itemName,
        itemPrice: item.itemPrice,
        qty: item.qty
      }))
    })
  } catch (error) {
    console.error('Checkout failed:', error)
    return NextResponse.json(
      { error: 'Checkout failed' },
      { status: 500 }
    )
  }
}
